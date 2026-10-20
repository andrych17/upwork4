import { useEffect, useState } from 'react'
import { clonePhoto, deleteScheduleItem, preparePhoto, putPhoto, saveTemplate } from './db'
import {
  findTemplate,
  move,
  SAMPLE_IDS,
  sessionMap,
  statusLabel,
  tasksForDate,
  todayKey,
  uid,
  withOrder,
} from './flow'
import { DEMO_PIN, digitsOnly, hashPin, safeEqual } from './pin'
import { Photo } from './photo'
import type { ScheduleItem, Settings, Snapshot, Template } from './types'
import { Btn, Eyebrow, fieldClass, Field, Frame, PhotoFrame } from './ui'

type Page =
  | { name: 'home' }
  | { name: 'templates' }
  | { name: 'edit' }
  | { name: 'phrases' }
  | { name: 'backup' }
  | { name: 'pin' }

type Props = {
  snapshot: Snapshot
  onLock: () => void
  onPreview: () => void
  onResume: (scheduleId: string) => void
  onSaved: (message: string) => void
  reload: () => Promise<void>
  saveTemplate: (template: Template) => Promise<void>
  saveSettings: (settings: Settings) => Promise<void>
  replaceDay: (date: string, items: ScheduleItem[]) => Promise<void>
  clearSession: (scheduleId: string) => Promise<void>
  exportBackup: () => Promise<void>
  importBackup: (file: File) => Promise<void>
}

const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'] as const

function applyPinKey(pin: string, key: string): string {
  if (key === 'clear') return ''
  if (key === 'del') return pin.slice(0, -1)
  return (pin + key).slice(0, 4)
}

function PinSlots({ pin }: { pin: string }) {
  return (
    <div
      className="rounded-[1.75rem] bg-[#E7E1D6] p-1.5"
      role="group"
      aria-label={pin.length === 4 ? `PIN ${pin.split('').join(' ')}` : `${pin.length} of 4 digits`}
    >
      <div className="grid grid-cols-4 divide-x divide-[#E7E1D6] overflow-hidden rounded-[calc(1.75rem-0.375rem)] bg-card shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        {[0, 1, 2, 3].map((index) => {
          const digit = pin[index]
          return (
            <div key={index} className="grid aspect-square place-items-center text-5xl font-bold tabular-nums">
              <span className={digit ? 'text-ink' : 'text-transparent'} aria-hidden="true">
                {digit ?? '0'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PinReadout({ pin }: { pin: string }) {
  return (
    <div className="flex w-full max-w-3xl items-end gap-2 sm:gap-4" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => {
        const digit = pin[index]
        return (
          <div
            key={index}
            className="digit-in flex min-w-0 flex-1 flex-col gap-3"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <span
              className={`text-center text-[clamp(3.5rem,20vw,7rem)] font-bold leading-[0.8] tabular-nums lg:text-[7.75rem] ${digit ? 'text-ink' : 'text-transparent'}`}
            >
              {digit ?? '0'}
            </span>
            <span className={`h-2 w-full rounded-full ${digit ? 'bg-[#C4A574]' : 'bg-ink/10'}`} />
          </div>
        )
      })}
    </div>
  )
}

function PinKeys({
  disabled,
  onPress,
  onPine = false,
}: {
  disabled?: boolean
  onPress: (key: string) => void
  onPine?: boolean
}) {
  return (
    <div className={`rounded-[1.75rem] p-1.5 ${onPine ? 'bg-white/10' : 'bg-white/70 ring-1 ring-black/5'}`}>
      <div className={`grid grid-cols-3 gap-2 rounded-[calc(1.75rem-0.375rem)] p-2 ${onPine ? 'bg-black/20' : 'bg-[#E7E1D6]'}`}>
        {PIN_KEYS.map((key) => {
          const word = key === 'clear' || key === 'del'
          const face = word
            ? onPine
              ? 'bg-transparent text-lg text-[#F7F1E6]'
              : 'bg-transparent text-lg text-ink'
            : onPine
              ? 'bg-[#F7F1E6] text-3xl text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]'
              : 'bg-card text-3xl text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]'
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onPress(key)}
              className={`min-h-[4.25rem] cursor-pointer rounded-[1.15rem] font-bold transition-transform duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E4DDD0] disabled:text-ink ${face}`}
            >
              {key === 'clear' ? 'Clear' : key === 'del' ? 'Delete' : key}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function StaffGate({
  settings,
  dayTitles,
  onUnlock,
  onCancel,
}: {
  settings: Settings
  dayTitles: string[]
  onUnlock: () => void
  onCancel: () => void
}) {
  const [pin, setPin] = useState(settings.pinIsDefault ? DEMO_PIN : '')
  const [error, setError] = useState<string | null>(null)
  const [lockedUntil, setLockedUntil] = useState(0)
  const [fails, setFails] = useState(0)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (lockedUntil <= Date.now()) return
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [lockedUntil])

  const waiting = lockedUntil > now

  async function submit(next = pin) {
    if (waiting) return
    if (!digitsOnly(next)) {
      setError('Enter 4 digits.')
      return
    }
    const hash = await hashPin(next, settings.pinSalt)
    if (!safeEqual(hash, settings.pinHash)) {
      const count = fails + 1
      setFails(count)
      setPin('')
      if (count >= 5) {
        setLockedUntil(Date.now() + 30_000)
        setFails(0)
        setError('Wait 30 seconds, then try again.')
      } else {
        setError('That PIN is not right.')
      }
      return
    }
    onUnlock()
  }

  function press(key: string) {
    setError(null)
    setPin((value) => applyPinKey(value, key))
  }

  const note = error
    ? error
    : waiting
      ? 'Wait 30 seconds, then try again.'
      : settings.pinIsDefault
        ? 'Demo code, ready to open.'
        : 'Type the 4 digits for this tablet.'

  const ready = pin.length === 4 && !waiting

  return (
    <div className="paper-grain flex min-h-dvh flex-col overflow-y-auto">
      <div className="m-auto flex w-full flex-col lg:m-0 lg:min-h-dvh lg:flex-row">
        <section className="relative px-6 pb-2 pt-[max(5.25rem,env(safe-area-inset-top))] lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:px-12 lg:py-10">
          <div className="absolute inset-x-6 top-[max(1.25rem,env(safe-area-inset-top))] flex items-center justify-between lg:inset-x-12">
            <Eyebrow>Staff</Eyebrow>
            <button type="button" onClick={onCancel} className="min-h-12 text-lg font-bold text-ink lg:hidden">
              Back to today
            </button>
          </div>
          <div>
            <p className="text-base font-bold uppercase tracking-[0.18em] text-mute">{settings.siteName}</p>
            <h1 className="sr-only">{pin.length === 4 ? `Staff PIN ${pin.split('').join(' ')}` : 'Enter the staff PIN'}</h1>
            <div className="mt-3">
              <PinReadout pin={pin} />
            </div>
            <p
              className={`mt-5 max-w-md text-xl leading-snug ${error ? 'font-bold text-bad' : 'text-mute'}`}
              role={error ? 'alert' : undefined}
            >
              {note}
            </p>
            {dayTitles.length > 0 ? (
              <div className="mt-8 hidden max-w-md sm:block">
                <p className="text-base font-bold uppercase tracking-[0.16em] text-mute">On the bench</p>
                <ol className="mt-3 grid gap-2">
                  {dayTitles.slice(0, 4).map((title, index) => (
                    <li key={`${index}-${title}`} className="flex items-baseline gap-4 text-2xl font-bold leading-snug">
                      <span className="w-9 shrink-0 tabular-nums text-pine">{String(index + 1).padStart(2, '0')}</span>
                      <span>{title}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            <button type="button" onClick={onCancel} className="mt-8 hidden min-h-12 text-lg font-bold text-ink lg:inline-flex">
              Back to today
            </button>
          </div>
        </section>
        <div className="hidden w-1.5 shrink-0 bg-[#C4A574] lg:block" aria-hidden="true" />
        <aside className="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 lg:flex lg:w-[23rem] lg:shrink-0 lg:items-center lg:bg-pine lg:px-6 lg:py-8">
          <div className="flex w-full flex-col gap-3 rounded-[2rem] bg-pine p-3 shadow-card lg:gap-4 lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none">
            <span className="mx-3 mt-2 h-1.5 rounded-full bg-[#C4A574] lg:hidden" aria-hidden="true" />
            <p className="px-3 text-base font-bold uppercase tracking-[0.16em] text-[#F7F1E6] lg:px-1">Four digits</p>
            <PinKeys onPine disabled={waiting} onPress={press} />
            <button
              type="button"
              disabled={!ready}
              onClick={() => submit()}
              className="grid min-h-20 w-full cursor-pointer grid-cols-[3.5rem_1fr_3.5rem] items-center rounded-full bg-[#F7F1E6] px-2 text-2xl font-bold text-pine transition-transform duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E4DDD0] disabled:text-ink"
            >
              <span />
              <span>Open staff</span>
              <span
                aria-hidden="true"
                className={`grid h-14 w-14 place-items-center justify-self-end rounded-full ${ready ? 'bg-pine text-[#F7F1E6]' : 'bg-ink/10 text-ink'}`}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}

export function StaffApp(props: Props) {
  const [page, setPage] = useState<Page>({ name: 'home' })
  const [draft, setDraft] = useState<Template | null>(null)
  const [dirty, setDirty] = useState(false)
  const [askLeave, setAskLeave] = useState(false)
  const [date, setDate] = useState(todayKey())

  function go(next: Page) {
    if (dirty) {
      setAskLeave(true)
      return
    }
    setPage(next)
  }

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <div className="mx-auto flex w-full max-w-3xl flex-col px-5 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-bold uppercase tracking-[0.14em] text-mute">Staff</p>
            <h1 className="mt-1 text-4xl font-bold">
              {page.name === 'home' && 'Today'}
              {page.name === 'templates' && 'Task templates'}
              {page.name === 'edit' && (draft?.title.trim() || 'New task')}
              {page.name === 'phrases' && 'Phrases'}
              {page.name === 'backup' && 'Backup'}
              {page.name === 'pin' && 'Change PIN'}
            </h1>
          </div>
          <Btn onClick={props.onLock}>Lock</Btn>
        </header>

        {page.name === 'home' ? (
          <Home {...props} date={date} setDate={setDate} onPage={go} />
        ) : null}
        {page.name === 'templates' ? (
          <Templates
            snapshot={props.snapshot}
            onBack={() => go({ name: 'home' })}
            onEdit={(template) => {
              setDraft(structuredClone(template))
              setDirty(false)
              setPage({ name: 'edit' })
            }}
            onNew={() => {
              setDraft(blankTemplate())
              setDirty(false)
              setPage({ name: 'edit' })
            }}
            onDuplicate={async (template) => {
              await duplicateTemplate(template)
              props.onSaved('Duplicated')
              await props.reload()
            }}
            onArchive={async (template, archived) => {
              await props.saveTemplate({ ...template, archived, updatedAt: Date.now() })
              props.onSaved(archived ? 'Archived' : 'Restored')
              await props.reload()
            }}
          />
        ) : null}
        {page.name === 'edit' && draft ? (
          <Editor
            draft={draft}
            setDraft={(next) => {
              setDraft(next)
              setDirty(true)
            }}
            onBack={() => go({ name: 'templates' })}
            onSave={async (template) => {
              await props.saveTemplate({ ...template, title: template.title.trim(), updatedAt: Date.now() })
              setDirty(false)
              props.onSaved('Saved')
              await props.reload()
              setPage({ name: 'templates' })
            }}
          />
        ) : null}
        {page.name === 'phrases' ? (
          <Phrases
            settings={props.snapshot.settings}
            onBack={() => go({ name: 'home' })}
            onSave={async (settings) => {
              await props.saveSettings(settings)
              props.onSaved('Saved')
              await props.reload()
            }}
          />
        ) : null}
        {page.name === 'backup' ? (
          <BackupPage
            onBack={() => go({ name: 'home' })}
            onExport={props.exportBackup}
            onImport={props.importBackup}
          />
        ) : null}
        {page.name === 'pin' ? (
          <PinPage
            settings={props.snapshot.settings}
            onBack={() => go({ name: 'home' })}
            onSave={async (settings) => {
              await props.saveSettings(settings)
              props.onSaved('PIN changed')
              await props.reload()
              setPage({ name: 'home' })
            }}
          />
        ) : null}
      </div>
      {askLeave ? (
        <Frame
          title="Leave without saving?"
          primary="Stay"
          secondary="Leave"
          onPrimary={() => setAskLeave(false)}
          onSecondary={() => {
            setDirty(false)
            setAskLeave(false)
            setPage(page.name === 'edit' ? { name: 'templates' } : { name: 'home' })
          }}
          body={<p>The changes on this screen will be dropped.</p>}
        />
      ) : null}
    </div>
  )
}

function blankTemplate(): Template {
  return {
    id: uid(),
    title: '',
    steps: [],
    checks: [],
    helpPhrase: '',
    donePhrase: '',
    archived: false,
    updatedAt: Date.now(),
  }
}

async function duplicateTemplate(template: Template): Promise<void> {
  const copy: Template = {
    ...structuredClone(template),
    id: uid(),
    title: `Copy of ${template.title}`.slice(0, 120),
    archived: false,
    updatedAt: Date.now(),
    steps: [],
    checks: template.checks.map((item) => ({ ...item, id: uid() })),
  }
  for (const step of template.steps) {
    copy.steps.push({ ...step, id: uid(), photoId: await clonePhoto(step.photoId) })
  }
  await saveTemplate(copy)
}

function Home(props: Props & { date: string; setDate: (date: string) => void; onPage: (page: Page) => void }) {
  const day = tasksForDate(props.snapshot.schedule, props.date)
  const map = sessionMap(props.snapshot.sessions)
  const [picker, setPicker] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [resetId, setResetId] = useState<string | null>(null)
  const samples = props.snapshot.templates.filter((template) => SAMPLE_IDS.includes(template.id as (typeof SAMPLE_IDS)[number]) && !template.archived)
  const activeTemplates = props.snapshot.templates.filter((template) => !template.archived)

  async function save(items: ScheduleItem[]) {
    await props.replaceDay(props.date, withOrder(items))
    await props.reload()
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <Field label="Day">
        <input className={fieldClass} type="date" value={props.date} onChange={(event) => props.setDate(event.target.value)} />
      </Field>
      <div className="flex flex-col gap-3">
        {day.length === 0 ? <p className="text-xl">Nothing is on this day yet.</p> : null}
        {day.map((item, index) => {
          const template = findTemplate(props.snapshot.templates, item.templateId)
          const session = map.get(item.id)
          return (
            <article key={item.id} className="rounded-[1.25rem] bg-card p-4 ring-1 ring-black/5">
              <p className="text-base font-bold uppercase tracking-[0.14em] text-mute">{index + 1}</p>
              <h2 className="text-2xl font-bold leading-tight">{template?.title || 'Missing task'}</h2>
              <p className="mt-1 text-lg text-mute">{statusLabel(session, template)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Btn onClick={() => save(move(day, index, -1))}>Up</Btn>
                <Btn onClick={() => save(move(day, index, 1))}>Down</Btn>
                <Btn onClick={() => setConfirmId(item.id)}>Remove</Btn>
                {session && session.status !== 'complete' ? (
                  <Btn tone="primary" onClick={() => props.onResume(item.id)}>Continue</Btn>
                ) : null}
                {session ? (
                  <Btn tone="danger" onClick={() => setResetId(item.id)}>
                    Reset
                  </Btn>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
      <Btn tone="primary" full onClick={() => setPicker(true)}>Add a task</Btn>
      {props.date === todayKey() && day.length === 0 && samples.length > 0 ? (
        <Btn
          full
          onClick={() =>
            save(
              samples.map((template) => ({
                id: uid(),
                date: props.date,
                templateId: template.id,
                order: 0,
              })),
            )
          }
        >
          Add the sample tasks
        </Btn>
      ) : null}
      <Btn full onClick={props.onPreview}>Preview student view</Btn>
      <Btn full onClick={() => props.onPage({ name: 'templates' })}>Task templates</Btn>
      <Btn full onClick={() => props.onPage({ name: 'phrases' })}>Phrases</Btn>
      <Btn full onClick={() => props.onPage({ name: 'backup' })}>Backup and restore</Btn>
      <Btn full onClick={() => props.onPage({ name: 'pin' })}>Change PIN</Btn>
      {picker ? (
        <Frame
          title="Add a task"
          primary="Close"
          onPrimary={() => setPicker(false)}
          body={
            <div className="flex max-h-[50dvh] flex-col gap-2 overflow-y-auto">
              {activeTemplates.length === 0 ? <p>Make a template first.</p> : null}
              {activeTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className="min-h-14 cursor-pointer rounded-2xl bg-paper px-4 text-left text-xl font-bold"
                  onClick={async () => {
                    await save([...day, { id: uid(), date: props.date, templateId: template.id, order: day.length }])
                    setPicker(false)
                  }}
                >
                  {template.title || 'Untitled'}
                </button>
              ))}
            </div>
          }
        />
      ) : null}
      {resetId ? (
        <Frame
          title="Start this task again?"
          primary="Reset"
          secondary="Keep progress"
          danger
          onSecondary={() => setResetId(null)}
          onPrimary={async () => {
            await props.clearSession(resetId)
            setResetId(null)
            props.onSaved('Reset')
            await props.reload()
          }}
          body={<p>The student starts from the beginning.</p>}
        />
      ) : null}
      {confirmId ? (
        <Frame
          title="Remove this from the day?"
          primary="Remove"
          secondary="Keep it"
          danger
          onSecondary={() => setConfirmId(null)}
          onPrimary={async () => {
            await deleteScheduleItem(confirmId)
            setConfirmId(null)
            props.onSaved('Removed')
            await props.reload()
          }}
          body={<p>The template stays. Progress on this copy is cleared.</p>}
        />
      ) : null}
    </div>
  )
}

function Templates({
  snapshot,
  onBack,
  onEdit,
  onNew,
  onDuplicate,
  onArchive,
}: {
  snapshot: Snapshot
  onBack: () => void
  onEdit: (template: Template) => void
  onNew: () => void
  onDuplicate: (template: Template) => Promise<void>
  onArchive: (template: Template, archived: boolean) => Promise<void>
}) {
  const [confirm, setConfirm] = useState<Template | null>(null)
  const active = snapshot.templates.filter((template) => !template.archived)
  const archived = snapshot.templates.filter((template) => template.archived)
  return (
    <div className="mt-6 flex flex-col gap-3">
      <Btn tone="primary" full onClick={onNew}>New template</Btn>
      {active.length === 0 ? <p className="text-xl">No templates yet.</p> : null}
      {active.map((template) => (
        <TemplateCard key={template.id} template={template} onEdit={onEdit} onDuplicate={onDuplicate} onArchive={() => setConfirm(template)} />
      ))}
      {archived.length > 0 ? <h2 className="mt-4 text-2xl font-bold">Archived</h2> : null}
      {archived.map((template) => (
        <article key={template.id} className="rounded-[1.25rem] bg-card p-4 ring-1 ring-black/5">
          <h3 className="text-2xl font-bold">{template.title || 'Untitled'}</h3>
          <div className="mt-3">
            <Btn onClick={() => onArchive(template, false)}>Restore</Btn>
          </div>
        </article>
      ))}
      <Btn onClick={onBack}>Back</Btn>
      {confirm ? (
        <Frame
          title="Archive this task?"
          primary="Archive"
          secondary="Keep it"
          danger
          onSecondary={() => setConfirm(null)}
          onPrimary={async () => {
            await onArchive(confirm, true)
            setConfirm(null)
          }}
          body={<p>It leaves the list you pick from. A day that already uses it keeps that copy until you remove it.</p>}
        />
      ) : null}
    </div>
  )
}

function TemplateCard({
  template,
  onEdit,
  onDuplicate,
  onArchive,
}: {
  template: Template
  onEdit: (template: Template) => void
  onDuplicate: (template: Template) => Promise<void>
  onArchive: () => void
}) {
  return (
    <article className="rounded-[1.25rem] bg-card p-4 ring-1 ring-black/5">
      <h2 className="text-2xl font-bold leading-tight">{template.title || 'Untitled'}</h2>
      <p className="mt-1 text-lg text-mute">
        {template.steps.length} steps · {template.checks.length} checks
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn tone="primary" onClick={() => onEdit(template)}>Edit</Btn>
        <Btn onClick={() => onDuplicate(template)}>Duplicate</Btn>
        <Btn tone="danger" onClick={onArchive}>Archive</Btn>
      </div>
    </article>
  )
}

function Editor({
  draft,
  setDraft,
  onBack,
  onSave,
}: {
  draft: Template
  setDraft: (template: Template) => void
  onBack: () => void
  onSave: (template: Template) => Promise<void>
}) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [photoTick, setPhotoTick] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)

  function patch(next: Template) {
    setDraft(next)
  }

  async function onPhoto(stepId: string, file: File | undefined) {
    if (!file) return
    setBusy(stepId)
    try {
      const blob = await preparePhoto(file)
      const step = draft.steps.find((item) => item.id === stepId)
      const photoId = step?.photoId || uid()
      await putPhoto(photoId, blob)
      patch({
        ...draft,
        steps: draft.steps.map((item) => (item.id === stepId ? { ...item, photoId } : item)),
      })
      setPhotoTick((value) => value + 1)
    } catch (error) {
      setErrors((prev) => ({ ...prev, [`photo-${stepId}`]: error instanceof Error ? error.message : 'Could not save the photo.' }))
    } finally {
      setBusy(null)
    }
  }

  function validate(template: Template) {
    const next: Record<string, string> = {}
    if (!template.title.trim()) next.title = 'Type a title.'
    for (const step of template.steps) {
      if (!step.text.trim()) next[`step-${step.id}`] = 'Write this step, or remove it.'
    }
    for (const item of template.checks) {
      if (!item.text.trim()) next[`check-${item.id}`] = 'Write this line, or remove it.'
    }
    return next
  }

  return (
    <form
      className="mt-6 flex flex-col gap-6"
      onSubmit={async (event) => {
        event.preventDefault()
        const next = validate(draft)
        setErrors(next)
        if (Object.keys(next).length > 0) return
        await onSave({
          ...draft,
          steps: draft.steps.map((step) => ({ ...step, text: step.text.trim(), alt: step.alt.trim() })),
          checks: draft.checks.map((item) => ({ ...item, text: item.text.trim() })),
          helpPhrase: draft.helpPhrase.trim(),
          donePhrase: draft.donePhrase.trim(),
        })
      }}
    >
      <Field label="Title" hint="Short, like Pack one box." error={errors.title}>
        <input className={fieldClass} value={draft.title} onChange={(event) => patch({ ...draft, title: event.target.value })} />
      </Field>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Steps</h2>
        {draft.steps.map((step, index) => (
          <article key={step.id} className="rounded-[1.25rem] bg-card p-4 ring-1 ring-black/5">
            <Field label={`Step ${index + 1}`} hint="One short sentence." error={errors[`step-${step.id}`]}>
              <textarea
                className={`${fieldClass} min-h-24 py-3`}
                value={step.text}
                onChange={(event) =>
                  patch({
                    ...draft,
                    steps: draft.steps.map((item) => (item.id === step.id ? { ...item, text: event.target.value } : item)),
                  })
                }
              />
            </Field>
            <div className="mt-3 max-w-sm">
              <PhotoFrame>
                <Photo id={step.photoId} alt={step.alt} version={photoTick} />
              </PhotoFrame>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <label className="inline-flex min-h-14 cursor-pointer items-center rounded-full bg-paper px-5 text-lg font-bold ring-1 ring-black/10">
                {busy === step.id ? 'Saving photo...' : step.photoId ? 'Change photo' : 'Add photo'}
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    void onPhoto(step.id, file)
                  }}
                />
              </label>
              <Btn onClick={() => patch({ ...draft, steps: move(draft.steps, index, -1) })}>Up</Btn>
              <Btn onClick={() => patch({ ...draft, steps: move(draft.steps, index, 1) })}>Down</Btn>
              <Btn tone="danger" onClick={() => patch({ ...draft, steps: draft.steps.filter((item) => item.id !== step.id) })}>
                Remove step
              </Btn>
            </div>
            {errors[`photo-${step.id}`] ? <p className="mt-2 font-bold text-bad">{errors[`photo-${step.id}`]}</p> : null}
            <div className="mt-3">
              <Field label="What is in the photo?" hint="Read aloud by a screen reader.">
                <input
                  className={fieldClass}
                  value={step.alt}
                  onChange={(event) =>
                    patch({
                      ...draft,
                      steps: draft.steps.map((item) => (item.id === step.id ? { ...item, alt: event.target.value } : item)),
                    })
                  }
                />
              </Field>
            </div>
          </article>
        ))}
        <Btn
          onClick={() =>
            patch({
              ...draft,
              steps: [...draft.steps, { id: uid(), text: '', photoId: null, alt: '' }],
            })
          }
        >
          Add a step
        </Btn>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Checklist</h2>
        {draft.checks.map((item, index) => (
          <article key={item.id} className="rounded-[1.25rem] bg-card p-4 ring-1 ring-black/5">
            <Field label={`Line ${index + 1}`} error={errors[`check-${item.id}`]}>
              <input
                className={fieldClass}
                value={item.text}
                onChange={(event) =>
                  patch({
                    ...draft,
                    checks: draft.checks.map((row) => (row.id === item.id ? { ...row, text: event.target.value } : row)),
                  })
                }
              />
            </Field>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn onClick={() => patch({ ...draft, checks: move(draft.checks, index, -1) })}>Up</Btn>
              <Btn onClick={() => patch({ ...draft, checks: move(draft.checks, index, 1) })}>Down</Btn>
              <Btn tone="danger" onClick={() => patch({ ...draft, checks: draft.checks.filter((row) => row.id !== item.id) })}>
                Remove line
              </Btn>
            </div>
          </article>
        ))}
        <Btn onClick={() => patch({ ...draft, checks: [...draft.checks, { id: uid(), text: '' }] })}>Add a line</Btn>
      </section>

      <Field label="Help phrase for this task" hint="Leave empty to use the phrase from Phrases.">
        <textarea className={`${fieldClass} min-h-24 py-3`} value={draft.helpPhrase} onChange={(event) => patch({ ...draft, helpPhrase: event.target.value })} />
      </Field>
      <Field label="Done phrase for this task" hint="The student says this to staff. Leave empty to use the default.">
        <textarea className={`${fieldClass} min-h-24 py-3`} value={draft.donePhrase} onChange={(event) => patch({ ...draft, donePhrase: event.target.value })} />
      </Field>
      <div className="sticky bottom-0 -mx-5 flex flex-col gap-3 bg-paper/95 px-5 py-4">
        <Btn tone="primary" full type="submit">Save task</Btn>
        <Btn full onClick={onBack}>Back</Btn>
      </div>
    </form>
  )
}

function Phrases({
  settings,
  onBack,
  onSave,
}: {
  settings: Settings
  onBack: () => void
  onSave: (settings: Settings) => Promise<void>
}) {
  const [siteName, setSiteName] = useState(settings.siteName)
  const [helpPhrase, setHelpPhrase] = useState(settings.helpPhrase)
  const [donePhrase, setDonePhrase] = useState(settings.donePhrase)
  return (
    <form
      className="mt-6 flex flex-col gap-5"
      onSubmit={async (event) => {
        event.preventDefault()
        await onSave({ ...settings, siteName: siteName.trim() || 'Station', helpPhrase: helpPhrase.trim(), donePhrase: donePhrase.trim() })
      }}
    >
      <Field label="Name on the tablet" hint="Shown on the Today screen. Nothing about a workplace is fixed in the app.">
        <input className={fieldClass} value={siteName} onChange={(event) => setSiteName(event.target.value)} />
      </Field>
      <Field label="Help phrase" hint="A task can use its own line. If that line is empty, the student sees this one.">
        <textarea className={`${fieldClass} min-h-28 py-3`} value={helpPhrase} onChange={(event) => setHelpPhrase(event.target.value)} />
      </Field>
      <Field label="Done phrase" hint="Used when a task does not have its own line.">
        <textarea className={`${fieldClass} min-h-28 py-3`} value={donePhrase} onChange={(event) => setDonePhrase(event.target.value)} />
      </Field>
      <Btn tone="primary" full type="submit">Save phrases</Btn>
      <Btn full onClick={onBack}>Back</Btn>
    </form>
  )
}

function BackupPage({
  onBack,
  onExport,
  onImport,
}: {
  onBack: () => void
  onExport: () => Promise<void>
  onImport: (file: File) => Promise<void>
}) {
  const [confirmFile, setConfirmFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="mt-6 flex flex-col gap-4">
      <p className="text-xl leading-snug">
        Tasks and photos stay on this tablet. Export a file if you want a copy. Import replaces everything on this tablet, including the PIN.
      </p>
      <Btn tone="primary" full onClick={() => onExport()}>Export backup</Btn>
      <label className="inline-flex min-h-14 cursor-pointer items-center justify-center rounded-full bg-card px-6 text-lg font-bold ring-1 ring-black/10">
        Choose a backup file
        <input
          className="sr-only"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) setConfirmFile(file)
          }}
        />
      </label>
      {error ? <p className="font-bold text-bad">{error}</p> : null}
      <Btn onClick={onBack}>Back</Btn>
      {confirmFile ? (
        <Frame
          title="Replace everything on this tablet?"
          primary="Restore"
          secondary="Cancel"
          danger
          onSecondary={() => setConfirmFile(null)}
          onPrimary={async () => {
            try {
              await onImport(confirmFile)
              setConfirmFile(null)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not restore the backup.')
              setConfirmFile(null)
            }
          }}
          body={<p>{confirmFile.name} will replace the tasks, photos, and PIN on this tablet.</p>}
        />
      ) : null}
    </div>
  )
}

function PinPage({
  settings,
  onBack,
  onSave,
}: {
  settings: Settings
  onBack: () => void
  onSave: (settings: Settings) => Promise<void>
}) {
  const [stage, setStage] = useState<'current' | 'next' | 'repeat'>('current')
  const [pin, setPin] = useState(settings.pinIsDefault ? DEMO_PIN : '')
  const [first, setFirst] = useState('')
  const [error, setError] = useState<string | null>(null)
  const label = stage === 'current' ? 'Current PIN' : stage === 'next' ? 'New PIN' : 'Repeat the new PIN'

  async function submit() {
    if (!digitsOnly(pin)) {
      setError('Enter 4 digits.')
      return
    }
    if (stage === 'current') {
      const hash = await hashPin(pin, settings.pinSalt)
      if (!safeEqual(hash, settings.pinHash)) {
        setError('That PIN is not right.')
        setPin('')
        return
      }
      setPin('')
      setStage('next')
      return
    }
    if (stage === 'next') {
      setFirst(pin)
      setPin('')
      setStage('repeat')
      return
    }
    if (pin !== first) {
      setError('Those two PINs do not match. Start the new PIN again.')
      setFirst('')
      setPin('')
      setStage('next')
      return
    }
    const salt = crypto.randomUUID()
    await onSave({ ...settings, pinSalt: salt, pinHash: await hashPin(pin, salt), pinIsDefault: false })
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(18rem,0.8fr)] lg:items-start">
      <div>
        <h2 className="text-3xl font-bold">{label}</h2>
        {stage === 'current' && settings.pinIsDefault ? (
          <p className="mt-3 text-xl text-mute">The current demo PIN is filled in as {DEMO_PIN}.</p>
        ) : null}
        <div className="mt-5 max-w-md">
          <PinSlots pin={pin} />
        </div>
        {error ? (
          <p role="alert" className="mt-4 text-lg font-bold text-bad">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex max-w-md flex-col gap-3">
        <PinKeys
          onPress={(key) => {
            setError(null)
            setPin((value) => applyPinKey(value, key))
          }}
        />
        <Btn tone="primary" full disabled={pin.length !== 4} onClick={() => submit()}>
          Continue
        </Btn>
        <Btn full onClick={onBack}>
          Back
        </Btn>
      </div>
    </div>
  )
}

