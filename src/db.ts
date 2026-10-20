import type { Backup, ScheduleItem, Session, Settings, Snapshot, Template } from './types'
import { parseBackup } from './flow'

const DB_NAME = 'station'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null
const urls = new Map<string, string>()

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const database = req.result
      if (!database.objectStoreNames.contains('kv')) database.createObjectStore('kv')
      if (!database.objectStoreNames.contains('templates')) {
        database.createObjectStore('templates', { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains('photos')) database.createObjectStore('photos')
      if (!database.objectStoreNames.contains('schedule')) {
        database.createObjectStore('schedule', { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains('sessions')) {
        database.createObjectStore('sessions', { keyPath: 'scheduleId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open the saved tasks.'))
  })
}

function db(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = openDb()
  return dbPromise
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Could not save.'))
    tx.onabort = () => reject(tx.error ?? new Error('Could not save.'))
  })
}

async function read<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const database = await db()
  const tx = database.transaction(storeName, 'readonly')
  const value = await new Promise<T | undefined>((resolve, reject) => {
    const req = tx.objectStore(storeName).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
  await txDone(tx)
  return value
}

async function write(storeName: string, value: unknown, key?: IDBValidKey): Promise<void> {
  const database = await db()
  const tx = database.transaction(storeName, 'readwrite')
  if (key === undefined) tx.objectStore(storeName).put(value)
  else tx.objectStore(storeName).put(value, key)
  await txDone(tx)
}

async function remove(storeName: string, key: IDBValidKey): Promise<void> {
  const database = await db()
  const tx = database.transaction(storeName, 'readwrite')
  tx.objectStore(storeName).delete(key)
  await txDone(tx)
}

async function allFrom<T>(storeName: string): Promise<T[]> {
  const database = await db()
  const tx = database.transaction(storeName, 'readonly')
  const rows = await new Promise<T[]>((resolve, reject) => {
    const req = tx.objectStore(storeName).getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
  await txDone(tx)
  return rows
}

export async function getSettings(): Promise<Settings | undefined> {
  return read<Settings>('kv', 'settings')
}

export async function saveSettings(settings: Settings): Promise<void> {
  await write('kv', settings, 'settings')
}

export async function saveTemplate(template: Template): Promise<void> {
  await write('templates', template)
}

export async function putPhoto(id: string, blob: Blob): Promise<void> {
  dropPhotoSrc(id)
  await write('photos', blob, id)
}

export async function getPhoto(id: string): Promise<Blob | undefined> {
  return read<Blob>('photos', id)
}

export async function clonePhoto(id: string | null): Promise<string | null> {
  if (!id) return null
  const blob = await getPhoto(id)
  if (!blob) return null
  const next = crypto.randomUUID()
  await putPhoto(next, blob)
  return next
}

export function dropPhotoSrc(id: string): void {
  const url = urls.get(id)
  if (url) URL.revokeObjectURL(url)
  urls.delete(id)
}

function dropAllPhotoSrc(): void {
  for (const url of urls.values()) URL.revokeObjectURL(url)
  urls.clear()
}

export async function photoSrc(id: string): Promise<string | null> {
  const cached = urls.get(id)
  if (cached) return cached
  const blob = await getPhoto(id)
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  urls.set(id, url)
  return url
}

export async function saveSession(session: Session): Promise<void> {
  await write('sessions', session)
}

export async function deleteSession(scheduleId: string): Promise<void> {
  await remove('sessions', scheduleId)
}

export async function replaceDay(date: string, items: ScheduleItem[]): Promise<void> {
  const database = await db()
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction('schedule', 'readwrite')
    const store = tx.objectStore('schedule')
    const get = store.getAll()
    get.onsuccess = () => {
      const all = get.result as ScheduleItem[]
      for (const item of all) {
        if (item.date === date) store.delete(item.id)
      }
      for (const item of items) store.put(item)
    }
    get.onerror = () => reject(get.error)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Could not save the day.'))
    tx.onabort = () => reject(tx.error ?? new Error('Could not save the day.'))
  })
}

export async function deleteScheduleItem(id: string): Promise<void> {
  await remove('schedule', id)
  await deleteSession(id)
}

export async function load(): Promise<Snapshot> {
  const settings = await getSettings()
  if (!settings) throw new Error('Tasks are not ready yet.')
  const [templates, schedule, sessions] = await Promise.all([
    allFrom<Template>('templates'),
    allFrom<ScheduleItem>('schedule'),
    allFrom<Session>('sessions'),
  ])
  return { settings, templates, schedule, sessions }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read a photo.'))
    reader.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  if (!res.ok) throw new Error('Could not read a photo in the backup.')
  return res.blob()
}

export async function exportBackup(): Promise<Backup> {
  const snap = await load()
  const database = await db()
  const pairs = await new Promise<{ id: string; blob: Blob }[]>((resolve, reject) => {
    const tx = database.transaction('photos', 'readonly')
    const store = tx.objectStore('photos')
    const keysReq = store.getAllKeys()
    const valsReq = store.getAll()
    let keys: IDBValidKey[] = []
    let vals: Blob[] = []
    let pending = 2
    const finish = () => {
      pending -= 1
      if (pending === 0) {
        resolve(keys.map((key, i) => ({ id: String(key), blob: vals[i] })))
      }
    }
    keysReq.onsuccess = () => {
      keys = keysReq.result
      finish()
    }
    valsReq.onsuccess = () => {
      vals = valsReq.result as Blob[]
      finish()
    }
    keysReq.onerror = () => reject(keysReq.error)
    valsReq.onerror = () => reject(valsReq.error)
  })
  const photos = []
  for (const pair of pairs) {
    photos.push({
      id: pair.id,
      mime: pair.blob.type || 'application/octet-stream',
      dataUrl: await blobToDataUrl(pair.blob),
    })
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: snap.settings,
    templates: snap.templates,
    schedule: snap.schedule,
    sessions: snap.sessions,
    photos,
  }
}

export async function importBackup(raw: unknown): Promise<void> {
  const backup = parseBackup(raw)
  if (!backup) throw new Error('That file is not a Station backup.')
  const photos: { id: string; blob: Blob }[] = []
  for (const photo of backup.photos) {
    photos.push({ id: photo.id, blob: await dataUrlToBlob(photo.dataUrl) })
  }
  const database = await db()
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(['kv', 'templates', 'photos', 'schedule', 'sessions'], 'readwrite')
    tx.objectStore('kv').clear()
    tx.objectStore('templates').clear()
    tx.objectStore('photos').clear()
    tx.objectStore('schedule').clear()
    tx.objectStore('sessions').clear()
    tx.objectStore('kv').put(backup.settings, 'settings')
    for (const template of backup.templates) tx.objectStore('templates').put(template)
    for (const item of backup.schedule) tx.objectStore('schedule').put(item)
    for (const session of backup.sessions) tx.objectStore('sessions').put(session)
    for (const photo of photos) tx.objectStore('photos').put(photo.blob, photo.id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Could not restore the backup.'))
    tx.onabort = () => reject(tx.error ?? new Error('Could not restore the backup.'))
  })
  dropAllPhotoSrc()
}

export async function preparePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Choose a photo.')
  try {
    const bitmap = await createImageBitmap(file)
    const max = 1400
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not save the photo.')
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (next) => (next ? resolve(next) : reject(new Error('Could not save the photo.'))),
        'image/jpeg',
        0.82,
      )
    })
    return blob
  } catch (error) {
    if (file.size > 4_000_000) {
      throw new Error('That photo is too large. Choose one under 4 MB.')
    }
    if (error instanceof Error && error.message.startsWith('That photo')) throw error
    if (error instanceof Error && error.message.startsWith('Choose')) throw error
    return file
  }
}
