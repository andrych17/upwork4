import { useEffect, useRef } from 'react'
import {
  afterNext,
  afterStart,
  checksComplete,
  clampStep,
  currentTask,
  doneLine,
  findTemplate,
  helpLine,
  isDone,
  nextOpen,
  sessionMap,
  tasksForDate,
  todayKey,
} from './flow'
import { Photo } from './photo'
import type { ScheduleItem, Session, Snapshot, StudentNav, Template } from './types'
import { Btn, Frame, PhotoFrame, Screen } from './ui'

type Props = {
  snapshot: Snapshot
  sessions: Session[]
  nav: StudentNav
  setNav: (nav: StudentNav) => void
  onSession: (session: Session) => void
  helpOpen: boolean
  setHelpOpen: (open: boolean) => void
  leaveOpen: boolean
  setLeaveOpen: (open: boolean) => void
  onStaff: () => void
  banner?: string | null
  onExitPreview?: () => void
}

function taskBySchedule(snapshot: Snapshot, scheduleId: string): { item: ScheduleItem; template: Template } | null {
  const item = snapshot.schedule.find((row) => row.id === scheduleId)
  if (!item) return null
  const template = findTemplate(snapshot.templates, item.templateId)
  if (!template) return null
  return { item, template }
}

export function StudentView(props: Props) {
  const { snapshot, sessions, nav, setNav, setHelpOpen, setLeaveOpen, banner, onExitPreview } = props
  const navRef = useRef(nav)
  navRef.current = nav
  const active = nav.name === 'how' || nav.name === 'check' || nav.name === 'done'

  useEffect(() => {
    history.pushState({ station: 1 }, '')
    const onPop = () => {
      history.pushState({ station: 1 }, '')
      const current = navRef.current
      if (current.name === 'how' || current.name === 'check' || current.name === 'done') {
        setLeaveOpen(true)
      } else if (current.name !== 'today') {
        setNav({ name: 'today' })
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [setLeaveOpen, setNav])

  useEffect(() => {
    if (!active) return
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [active])

  const day = tasksForDate(snapshot.schedule, todayKey())
  const map = sessionMap(sessions)
  const opened = nav.name === 'today' ? null : taskBySchedule(snapshot, nav.scheduleId)
  const session = opened ? map.get(opened.item.id) : undefined
  const helpText = opened
    ? helpLine(opened.template.helpPhrase, snapshot.settings.helpPhrase)
    : helpLine('', snapshot.settings.helpPhrase)

  function goToday() {
    setHelpOpen(false)
    setLeaveOpen(false)
    setNav({ name: 'today' })
  }

  function openTask(item: ScheduleItem) {
    const row = taskBySchedule(snapshot, item.id)
    if (!row || isDone(map.get(item.id))) return
    const existing = map.get(item.id)
    if (!existing) {
      setNav({ name: 'now', scheduleId: item.id })
      return
    }
    if (existing.status === 'how') setNav({ name: 'how', scheduleId: item.id })
    else if (existing.status === 'check') setNav({ name: 'check', scheduleId: item.id })
    else if (existing.status === 'report') setNav({ name: 'done', scheduleId: item.id })
    else setNav({ name: 'now', scheduleId: item.id })
  }

  function write(next: Session, screen: StudentNav['name']) {
    props.onSession(next)
    setNav({ name: screen, scheduleId: next.scheduleId })
  }

  function start(item: ScheduleItem, template: Template) {
    const adv = afterStart(template)
    const next: Session = {
      scheduleId: item.id,
      status: adv.screen === 'how' ? 'how' : adv.screen === 'check' ? 'check' : 'report',
      stepIndex: adv.screen === 'how' ? adv.stepIndex : 0,
      ticks: {},
      updatedAt: Date.now(),
    }
    write(next, adv.screen === 'report' ? 'done' : adv.screen)
  }

  let body = (
    <Today
      siteName={snapshot.settings.siteName}
      day={day}
      templates={snapshot.templates}
      map={map}
      onOpen={openTask}
      onStaff={props.onStaff}
      onHelp={() => setHelpOpen(true)}
    />
  )

  if (nav.name !== 'today' && !opened) {
    body = (
      <Screen
        eyebrow="Today"
        title="This task is missing."
        onHelp={() => setHelpOpen(true)}
        footer={<Btn tone="primary" full onClick={goToday}>Back to today</Btn>}
      >
        <p className="mt-4 text-2xl">Ask a staff member.</p>
      </Screen>
    )
  } else if (opened && nav.name === 'now') {
    body = (
      <Screen
        eyebrow="Now"
        title={opened.template.title}
        onHelp={() => setHelpOpen(true)}
        focusTitle={!props.helpOpen && !props.leaveOpen}
        footer={
          <Btn tone="primary" size="lg" full onClick={() => start(opened.item, opened.template)}>
            Start
          </Btn>
        }
      >
        <p className="mt-4 text-2xl leading-snug text-mute">Tap start when you are ready.</p>
      </Screen>
    )
  } else if (opened && nav.name === 'how') {
    const index = clampStep(session?.stepIndex ?? 0, opened.template.steps.length)
    const step = opened.template.steps[index]
    if (!step || !session) {
      body = (
        <Screen
          eyebrow="Now"
          title={opened.template.title}
          onHelp={() => setHelpOpen(true)}
          footer={<Btn tone="primary" full onClick={() => start(opened.item, opened.template)}>Start</Btn>}
        >
          <p className="mt-4 text-2xl">Tap start when you are ready.</p>
        </Screen>
      )
    } else {
      const last = index === opened.template.steps.length - 1
      const nextLabel = last ? (opened.template.checks.length > 0 ? 'Check' : 'Done') : 'Next'
      body = (
        <Screen
          eyebrow={`Step ${index + 1} of ${opened.template.steps.length}`}
          title={step.text}
          onHelp={() => setHelpOpen(true)}
          focusTitle={!props.helpOpen && !props.leaveOpen}
          wide
          media={
            <PhotoFrame>
              <Photo id={step.photoId} alt={step.alt} version={opened.template.updatedAt} />
            </PhotoFrame>
          }
          footer={
            <div className="flex flex-col gap-3">
              <div className={`grid gap-3 ${index > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {index > 0 ? (
                  <Btn
                    onClick={() =>
                      write({ ...session, stepIndex: index - 1, status: 'how', updatedAt: Date.now() }, 'how')
                    }
                  >
                    Back
                  </Btn>
                ) : null}
                <Btn
                  tone="primary"
                  onClick={() => {
                    const adv = afterNext(opened.template, index)
                    write(
                      {
                        ...session,
                        status: adv.screen === 'how' ? 'how' : adv.screen === 'check' ? 'check' : 'report',
                        stepIndex: adv.screen === 'how' ? adv.stepIndex : index,
                        updatedAt: Date.now(),
                      },
                      adv.screen === 'report' ? 'done' : adv.screen,
                    )
                  }}
                >
                  {nextLabel}
                </Btn>
              </div>
              <button type="button" className="min-h-12 text-lg font-bold text-mute underline-offset-4 hover:underline cursor-pointer" onClick={() => setLeaveOpen(true)}>
                Pause and save
              </button>
            </div>
          }
        >
          </Screen>
      )
    }
  } else if (opened && nav.name === 'check' && session) {
    const ready = checksComplete(opened.template, session.ticks)
    body = (
      <Screen
        eyebrow="Check"
        title="Check your work"
        onHelp={() => setHelpOpen(true)}
        focusTitle={!props.helpOpen && !props.leaveOpen}
        footer={
          <div className="flex flex-col gap-3">
            <Btn
              tone="primary"
              full
              disabled={!ready}
              onClick={() => write({ ...session, status: 'report', updatedAt: Date.now() }, 'done')}
            >
              {ready ? 'Done checking' : 'Tick every line first'}
            </Btn>
            <Btn
              onClick={() => {
                if (opened.template.steps.length === 0) {
                  setLeaveOpen(true)
                  return
                }
                write(
                  {
                    ...session,
                    status: 'how',
                    stepIndex: opened.template.steps.length - 1,
                    updatedAt: Date.now(),
                  },
                  'how',
                )
              }}
            >
              Back
            </Btn>
          </div>
        }
      >
        <ul className="mt-5 flex flex-col gap-3">
          {opened.template.checks.map((item) => {
            const on = session.ticks[item.id] === true
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    props.onSession({
                      ...session,
                      ticks: { ...session.ticks, [item.id]: !on },
                      updatedAt: Date.now(),
                    })
                  }
                  className={`flex min-h-[4.75rem] w-full cursor-pointer items-center gap-4 rounded-[1.25rem] px-4 text-left text-2xl font-bold leading-snug active:scale-[0.99] ${on ? 'bg-pine text-white' : 'bg-card text-ink ring-1 ring-black/10'}`}
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ring-2 ${on ? 'ring-white' : 'ring-ink'}`} aria-hidden>
                    {on ? (
                      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M5 12.5 10 17.5 19 7.5" />
                      </svg>
                    ) : null}
                  </span>
                  {item.text}
                </button>
              </li>
            )
          })}
        </ul>
      </Screen>
    )
  } else if (opened && nav.name === 'done' && session) {
    body = (
      <Screen
        eyebrow="Done"
        title="Tell a staff member"
        onHelp={() => setHelpOpen(true)}
        focusTitle={!props.helpOpen && !props.leaveOpen}
        footer={
          <Btn
            tone="primary"
            size="lg"
            full
            onClick={() => write({ ...session, status: 'complete', updatedAt: Date.now() }, 'next')}
          >
            I told them
          </Btn>
        }
      >
        <p className="mt-4 text-xl text-mute">You can say</p>
        <blockquote className="mt-3 rounded-[1.75rem] bg-card px-6 py-8 text-4xl font-bold leading-tight ring-1 ring-black/5 shadow-card">
          {doneLine(opened.template.donePhrase, snapshot.settings.donePhrase)}
        </blockquote>
      </Screen>
    )
  } else if (opened && nav.name === 'next') {
    const upcoming = nextOpen(day, map, opened.item.id)
    const upcomingTemplate = upcoming ? findTemplate(snapshot.templates, upcoming.templateId) : undefined
    body = upcoming && upcomingTemplate ? (
      <Screen
        eyebrow="Next"
        title={upcomingTemplate.title}
        onHelp={() => setHelpOpen(true)}
        footer={
          <Btn tone="primary" size="lg" full onClick={() => setNav({ name: 'now', scheduleId: upcoming.id })}>
            Go to this task
          </Btn>
        }
      >
        <p className="mt-4 text-2xl text-mute">This is the next task.</p>
      </Screen>
    ) : (
      <Screen
        eyebrow="Next"
        title="That's everything for today."
        onHelp={() => setHelpOpen(true)}
        footer={<Btn tone="primary" full onClick={goToday}>Back to today</Btn>}
      >
        <p className="mt-4 text-2xl text-mute">You can tell a staff member you are finished.</p>
      </Screen>
    )
  }

  return (
    <div className="relative min-h-dvh">
      {banner ? (
        <div className="flex items-center justify-between gap-3 bg-ink px-5 py-3 text-white">
          <p className="text-lg font-bold">{banner}. This does not change today's progress.</p>
          {onExitPreview ? (
            <button type="button" className="min-h-12 shrink-0 rounded-full bg-white px-4 text-lg font-bold text-ink cursor-pointer" onClick={onExitPreview}>
              Exit preview
            </button>
          ) : null}
        </div>
      ) : null}
      {body}
      {props.helpOpen ? (
        <Frame
          title="I need help"
          primary="I'm ready"
          onPrimary={() => setHelpOpen(false)}
          body={
            <div>
              <p className="text-mute">You can say</p>
              <p className="mt-3 text-3xl font-bold leading-tight text-ink">{helpText}</p>
            </div>
          }
        />
      ) : null}
      {props.leaveOpen ? (
        <Frame
          title="Leave this task?"
          primary="Stay"
          secondary="Save and leave"
          onPrimary={() => setLeaveOpen(false)}
          onSecondary={goToday}
          body={<p>Your place is saved. You can continue later.</p>}
        />
      ) : null}
    </div>
  )
}

function Today({
  siteName,
  day,
  templates,
  map,
  onOpen,
  onStaff,
  onHelp,
}: {
  siteName: string
  day: ScheduleItem[]
  templates: Template[]
  map: Map<string, Session>
  onOpen: (item: ScheduleItem) => void
  onStaff: () => void
  onHelp: () => void
}) {
  const current = currentTask(day, map)
  return (
    <Screen
      eyebrow={siteName || 'Today'}
      title="Today"
      onHelp={onHelp}
      footer={
        <button type="button" className="min-h-12 w-full text-lg font-bold text-mute cursor-pointer" onClick={onStaff}>
          Staff
        </button>
      }
    >
      {day.length === 0 ? (
        <p className="mt-6 text-2xl leading-snug">Nothing is scheduled today. Ask a staff member.</p>
      ) : (
        <ol className="mt-5 flex flex-col gap-3">
          {day.map((item) => {
            const template = findTemplate(templates, item.templateId)
            const title = template?.title || 'Task unavailable'
            const session = map.get(item.id)
            const done = isDone(session)
            const now = current?.id === item.id
            if (now) {
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(item)}
                    className="w-full cursor-pointer rounded-[1.5rem] bg-card p-5 text-left ring-1 ring-pine/25 shadow-card active:scale-[0.99]"
                  >
                    <span className="text-base font-bold uppercase tracking-[0.14em] text-pine">Now</span>
                    <span className="mt-1 block text-3xl font-bold leading-tight">{title}</span>
                    <span className="mt-4 inline-flex min-h-12 items-center rounded-full bg-pine px-5 text-lg font-bold text-white">
                      {session ? 'Continue' : 'Start'}
                    </span>
                  </button>
                </li>
              )
            }
            return (
              <li key={item.id} className="rounded-[1.25rem] bg-card px-5 py-4 ring-1 ring-black/5">
                <p className="text-base font-bold uppercase tracking-[0.14em] text-mute">{done ? 'Done' : 'Not yet'}</p>
                <p className="mt-1 text-2xl font-bold leading-tight">{title}</p>
              </li>
            )
          })}
        </ol>
      )}
      {day.length > 0 && !current ? (
        <p className="mt-6 text-2xl">That's everything for today.</p>
      ) : null}
    </Screen>
  )
}
