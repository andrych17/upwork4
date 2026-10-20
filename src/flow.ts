import type { Backup, ScheduleItem, Session, Settings, Template } from './types'

export function uid(): string {
  return crypto.randomUUID()
}

export function todayKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function move<T>(list: readonly T[], index: number, dir: -1 | 1): T[] {
  const next = index + dir
  if (index < 0 || index >= list.length || next < 0 || next >= list.length) return [...list]
  const copy = [...list]
  const [row] = copy.splice(index, 1)
  copy.splice(next, 0, row)
  return copy
}

export function withOrder<T extends { order: number }>(items: readonly T[]): T[] {
  return items.map((item, order) => ({ ...item, order }))
}

export function tasksForDate(items: readonly ScheduleItem[], date: string): ScheduleItem[] {
  return items
    .filter((item) => item.date === date)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

export function sessionMap(sessions: readonly Session[]): Map<string, Session> {
  return new Map(sessions.map((session) => [session.scheduleId, session]))
}

export function isDone(session: Session | undefined): boolean {
  return session?.status === 'complete'
}

export function currentTask(
  items: readonly ScheduleItem[],
  sessions: ReadonlyMap<string, Session>,
): ScheduleItem | null {
  return items.find((item) => !isDone(sessions.get(item.id))) ?? null
}

export function nextOpen(
  items: readonly ScheduleItem[],
  sessions: ReadonlyMap<string, Session>,
  afterId: string,
): ScheduleItem | null {
  const index = items.findIndex((item) => item.id === afterId)
  for (let i = index + 1; i < items.length; i += 1) {
    if (!isDone(sessions.get(items[i].id))) return items[i]
  }
  return null
}

export type Advance =
  | { screen: 'how'; stepIndex: number }
  | { screen: 'check' }
  | { screen: 'report' }

export function afterStart(template: Template): Advance {
  if (template.steps.length > 0) return { screen: 'how', stepIndex: 0 }
  if (template.checks.length > 0) return { screen: 'check' }
  return { screen: 'report' }
}

export function afterNext(template: Template, stepIndex: number): Advance {
  if (stepIndex + 1 < template.steps.length) return { screen: 'how', stepIndex: stepIndex + 1 }
  if (template.checks.length > 0) return { screen: 'check' }
  return { screen: 'report' }
}

export function checksComplete(template: Template, ticks: Record<string, boolean>): boolean {
  return template.checks.every((item) => ticks[item.id] === true)
}

export function helpLine(custom: string, fallback: string): string {
  return custom.trim() || fallback.trim() || 'Please can you help me?'
}

export function doneLine(custom: string, fallback: string): string {
  return custom.trim() || fallback.trim() || 'I have finished this task.'
}

export function clampStep(index: number, count: number): number {
  if (count <= 0) return 0
  return Math.min(Math.max(0, index), count - 1)
}

export function statusLabel(session: Session | undefined, template: Template | undefined): string {
  if (!session) return 'Not started'
  if (session.status === 'complete') return 'Done'
  if (session.status === 'report') return 'Waiting to tell staff'
  if (session.status === 'check') return 'On the checklist'
  const total = template?.steps.length ?? 0
  if (session.status === 'how' && total > 0) {
    return `On step ${clampStep(session.stepIndex, total) + 1} of ${total}`
  }
  return 'In progress'
}

export function findTemplate(templates: readonly Template[], id: string): Template | undefined {
  return templates.find((template) => template.id === id)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function isSettings(value: unknown): value is Settings {
  if (!isRecord(value)) return false
  return (
    typeof value.siteName === 'string' &&
    typeof value.pinHash === 'string' &&
    typeof value.pinSalt === 'string' &&
    typeof value.pinIsDefault === 'boolean' &&
    typeof value.helpPhrase === 'string' &&
    typeof value.donePhrase === 'string'
  )
}

export function parseBackup(value: unknown): Backup | null {
  if (!isRecord(value) || value.version !== 1) return null
  if (!isSettings(value.settings)) return null
  if (!Array.isArray(value.templates) || !Array.isArray(value.schedule)) return null
  if (!Array.isArray(value.sessions) || !Array.isArray(value.photos)) return null
  for (const template of value.templates) {
    if (!isRecord(template)) return null
    if (typeof template.id !== 'string' || typeof template.title !== 'string') return null
    if (!Array.isArray(template.steps) || !Array.isArray(template.checks)) return null
  }
  for (const photo of value.photos) {
    if (!isRecord(photo)) return null
    if (typeof photo.id !== 'string' || typeof photo.dataUrl !== 'string') return null
    if (!photo.dataUrl.startsWith('data:')) return null
  }
  return value as Backup
}

export const SAMPLE_IDS = ['tpl-bench', 'tpl-pack', 'tpl-label'] as const
