import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Tone = 'primary' | 'quiet' | 'danger' | 'help'

const tones: Record<Tone, string> = {
  primary: 'bg-pine text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]',
  quiet: 'bg-card text-ink shadow-[inset_0_0_0_1.5px_rgba(28,25,23,0.14)]',
  danger: 'bg-card text-bad shadow-[inset_0_0_0_1.5px_rgba(127,29,29,0.4)]',
  help: 'bg-helpbg text-help shadow-[inset_0_0_0_1.5px_rgba(107,58,10,0.22)]',
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone
  full?: boolean
  size?: 'md' | 'lg'
}

export function Btn({
  tone = 'quiet',
  full = false,
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...props
}: BtnProps) {
  const height = size === 'lg' ? 'min-h-24 text-3xl' : 'min-h-14 text-lg'
  return (
    <button
      type={type}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full px-6 font-bold transition-transform duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E4DDD0] disabled:text-ink disabled:shadow-none disabled:active:scale-100 ${tones[tone]} ${height} ${full ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export const fieldClass =
  'w-full min-h-14 rounded-2xl bg-card px-4 text-lg text-ink shadow-[inset_0_0_0_1.5px_rgba(28,25,23,0.16)]'

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-lg font-bold">{label}</span>
      {children}
      {hint ? <span className="mt-2 block text-base leading-snug text-mute">{hint}</span> : null}
      {error ? (
        <span role="alert" className="mt-2 block text-base font-bold text-bad">
          {error}
        </span>
      ) : null}
    </label>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center rounded-full bg-card px-3 py-1 text-base font-bold uppercase tracking-[0.14em] text-mute ring-1 ring-black/5">
      {children}
    </p>
  )
}

export function Screen({
  eyebrow,
  title,
  focusTitle,
  onHelp,
  children,
  footer,
  wide = false,
  media,
}: {
  eyebrow: string
  title?: string
  focusTitle?: boolean
  onHelp?: () => void
  children?: ReactNode
  footer?: ReactNode
  wide?: boolean
  media?: ReactNode
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (focusTitle === false || !title) return
    heading.current?.focus()
  }, [title, focusTitle])

  const headingEl = title ? (
    <h1 ref={heading} tabIndex={-1} className="text-balance text-4xl font-bold leading-[1.15] outline-none md:text-5xl">
      {title}
    </h1>
  ) : null

  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink select-none" data-screen={eyebrow.toLowerCase()}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded-full focus:bg-card focus:px-4 focus:py-3"
      >
        Skip to the task
      </a>
      <header className="flex items-center justify-between gap-4 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
        <Eyebrow>{eyebrow}</Eyebrow>
        {onHelp ? (
          <Btn tone="help" onClick={onHelp} className="shrink-0">
            I need help
          </Btn>
        ) : null}
      </header>
      <main
        id="main"
        className={`screen-in mx-auto flex w-full min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-4 ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}
      >
        {media ? (
          <div className="grid flex-1 content-center gap-6 md:landscape:grid-cols-[1.05fr_0.95fr] md:landscape:items-center">
            {media}
            <div>
              {headingEl}
              {children}
            </div>
          </div>
        ) : (
          <>
            {headingEl}
            {children}
          </>
        )}
      </main>
      {footer ? (
        <div className={`mx-auto w-full px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>
          {footer}
        </div>
      ) : (
        <div className="h-[max(0.5rem,env(safe-area-inset-bottom))]" />
      )}
    </div>
  )
}

export function Frame({
  title,
  body,
  primary,
  secondary,
  onPrimary,
  onSecondary,
  danger = false,
}: {
  title: string
  body: ReactNode
  primary: string
  secondary?: string
  onPrimary: () => void
  onSecondary?: () => void
  danger?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const onSecondaryRef = useRef(onSecondary)
  onSecondaryRef.current = onSecondary
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const previous = document.activeElement as HTMLElement | null
    const focusables = () =>
      [...root.querySelectorAll<HTMLElement>('button, [href], input, textarea')].filter(
        (el) => !el.hasAttribute('disabled'),
      )
    focusables()[0]?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onSecondaryRef.current?.()
      if (event.key !== 'Tab') return
      const list = focusables()
      if (list.length === 0) return
      const first = list[0]
      const last = list[list.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50 p-4 sm:items-center" role="presentation">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-[1.75rem] bg-white/70 p-1.5 ring-1 ring-black/10"
      >
        <div className="rounded-[calc(1.75rem-0.375rem)] bg-card px-6 py-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
          <h2 id={titleId} className="text-3xl font-bold leading-tight">
            {title}
          </h2>
          <div className="mt-3 text-xl leading-snug">{body}</div>
          <div className="mt-6 flex flex-col gap-3">
            <Btn tone={danger ? 'danger' : 'primary'} full onClick={onPrimary}>
              {primary}
            </Btn>
            {secondary && onSecondary ? (
              <Btn tone="quiet" full onClick={onSecondary}>
                {secondary}
              </Btn>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export function Toast({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
      <p role="status" aria-live="polite" className="rounded-full bg-ink px-5 py-3 text-lg font-bold text-white">
        {text}
      </p>
    </div>
  )
}

export function PhotoFrame({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[1.75rem] bg-white/80 p-1.5 ring-1 ring-black/5 shadow-card">
      <div className="aspect-[4/3] overflow-hidden rounded-[calc(1.75rem-0.375rem)] bg-wash">{children}</div>
    </div>
  )
}
