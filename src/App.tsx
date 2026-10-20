import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import {
  deleteSession,
  exportBackup,
  importBackup,
  load,
  replaceDay,
  saveSession,
  saveSettings,
  saveTemplate,
} from './db'
import { ensureSeed } from './seed'
import { StaffApp, StaffGate } from './staff'
import { StudentView } from './student'
import { findTemplate, tasksForDate, todayKey } from './flow'
import type { ScheduleItem, Session, Settings, Snapshot, StudentNav, Template } from './types'
import { Btn, Toast } from './ui'

registerSW({ immediate: true })

export function App() {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [area, setArea] = useState<'student' | 'staff'>('student')
  const [authed, setAuthed] = useState(false)
  const [preview, setPreview] = useState(false)
  const [previewSessions, setPreviewSessions] = useState<Session[]>([])
  const [nav, setNav] = useState<StudentNav>({ name: 'today' })
  const [helpOpen, setHelpOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  async function refresh() {
    const next = await load()
    setSnap(next)
    return next
  }

  useEffect(() => {
    let alive = true
    ensureSeed()
      .then(() => load())
      .then((next) => {
        if (alive) setSnap(next)
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : 'Could not open the saved tasks.')
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (snap?.settings.siteName) document.title = snap.settings.siteName
  }, [snap?.settings.siteName])

  async function onSession(session: Session) {
    if (preview) {
      setPreviewSessions((prev) => [...prev.filter((row) => row.scheduleId !== session.scheduleId), session])
      return
    }
    await saveSession(session)
    await refresh()
  }

  function openStaff() {
    if (preview) {
      setPreview(false)
      setArea('staff')
      return
    }
    setHelpOpen(false)
    setLeaveOpen(false)
    setArea('staff')
  }

  if (error) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <h1 className="text-3xl font-bold">This tablet could not open the saved tasks.</h1>
          <p className="mt-3 text-xl">{error}</p>
          <div className="mt-6">
            <Btn tone="primary" onClick={() => window.location.reload()}>
              Try again
            </Btn>
          </div>
        </div>
      </div>
    )
  }

  if (!snap) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <p className="text-2xl font-bold">Loading</p>
      </div>
    )
  }

  if (preview || area === 'student') {
    return (
      <>
        <StudentView
          snapshot={snap}
          sessions={preview ? previewSessions : snap.sessions}
          nav={nav}
          setNav={setNav}
          onSession={onSession}
          helpOpen={helpOpen}
          setHelpOpen={setHelpOpen}
          leaveOpen={leaveOpen}
          setLeaveOpen={setLeaveOpen}
          onStaff={openStaff}
          banner={preview ? 'Preview' : null}
          onExitPreview={
            preview
              ? () => {
                  setPreview(false)
                  setArea('staff')
                  setNav({ name: 'today' })
                }
              : undefined
          }
        />
        <Toast text={toast} />
      </>
    )
  }

  if (!authed) {
    return (
      <StaffGate
        settings={snap.settings}
        dayTitles={tasksForDate(snap.schedule, todayKey()).flatMap((item) => {
          const title = findTemplate(snap.templates, item.templateId)?.title
          return title ? [title] : []
        })}
        onCancel={() => setArea('student')}
        onUnlock={() => setAuthed(true)}
      />
    )
  }

  return (
    <>
      <StaffApp
        snapshot={snap}
        onLock={() => {
          setAuthed(false)
          setArea('student')
          setNav({ name: 'today' })
        }}
        onPreview={() => {
          setPreviewSessions([])
          setPreview(true)
          setNav({ name: 'today' })
          setHelpOpen(false)
          setLeaveOpen(false)
        }}
        onResume={(scheduleId) => {
          const session = snap.sessions.find((row) => row.scheduleId === scheduleId)
          setAuthed(false)
          setArea('student')
          setPreview(false)
          if (!session || session.status === 'complete') setNav({ name: 'now', scheduleId })
          else if (session.status === 'how') setNav({ name: 'how', scheduleId })
          else if (session.status === 'check') setNav({ name: 'check', scheduleId })
          else setNav({ name: 'done', scheduleId })
        }}
        onSaved={setToast}
        reload={async () => {
          await refresh()
        }}
        saveTemplate={async (template: Template) => {
          await saveTemplate(template)
        }}
        saveSettings={async (settings: Settings) => {
          await saveSettings(settings)
        }}
        replaceDay={async (date: string, items: ScheduleItem[]) => {
          await replaceDay(date, items)
        }}
        clearSession={async (scheduleId: string) => {
          await deleteSession(scheduleId)
        }}
        exportBackup={async () => {
          const backup = await exportBackup()
          const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `station-backup-${todayKey()}.json`
          link.click()
          URL.revokeObjectURL(url)
          setToast('Backup downloaded')
        }}
        importBackup={async (file: File) => {
          let raw: unknown
          try {
            raw = JSON.parse(await file.text())
          } catch {
            throw new Error('That file could not be read.')
          }
          await importBackup(raw)
          await refresh()
          setToast('Restored')
        }}
      />
      <Toast text={toast} />
    </>
  )
}
