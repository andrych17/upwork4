export type Step = {
  id: string
  text: string
  photoId: string | null
  alt: string
}

export type CheckItem = {
  id: string
  text: string
}

export type Template = {
  id: string
  title: string
  steps: Step[]
  checks: CheckItem[]
  helpPhrase: string
  donePhrase: string
  archived: boolean
  updatedAt: number
}

export type ScheduleItem = {
  id: string
  date: string
  templateId: string
  order: number
}

export type SessionStatus = 'how' | 'check' | 'report' | 'complete'

export type Session = {
  scheduleId: string
  status: SessionStatus
  stepIndex: number
  ticks: Record<string, boolean>
  updatedAt: number
}

export type Settings = {
  siteName: string
  pinHash: string
  pinSalt: string
  pinIsDefault: boolean
  helpPhrase: string
  donePhrase: string
}

export type Snapshot = {
  settings: Settings
  templates: Template[]
  schedule: ScheduleItem[]
  sessions: Session[]
}

export type PhotoRecord = {
  id: string
  mime: string
  dataUrl: string
}

export type Backup = {
  version: 1
  exportedAt: string
  settings: Settings
  templates: Template[]
  schedule: ScheduleItem[]
  sessions: Session[]
  photos: PhotoRecord[]
}

export type StudentNav =
  | { name: 'today' }
  | { name: 'now'; scheduleId: string }
  | { name: 'how'; scheduleId: string }
  | { name: 'check'; scheduleId: string }
  | { name: 'done'; scheduleId: string }
  | { name: 'next'; scheduleId: string }
