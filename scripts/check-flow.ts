import assert from 'node:assert/strict'
import {
  afterNext,
  afterStart,
  checksComplete,
  currentTask,
  doneLine,
  helpLine,
  move,
  nextOpen,
  parseBackup,
  statusLabel,
  tasksForDate,
} from '../src/flow.ts'
import { DEMO_PIN, hashPin, safeEqual } from '../src/pin.ts'
import type { ScheduleItem, Session, Template } from '../src/types.ts'

function template(partial: Partial<Template> = {}): Template {
  return {
    id: 't1',
    title: 'Pack',
    steps: [
      { id: 's1', text: 'One', photoId: null, alt: '' },
      { id: 's2', text: 'Two', photoId: null, alt: '' },
    ],
    checks: [{ id: 'c1', text: 'Inside' }],
    helpPhrase: '',
    donePhrase: '',
    archived: false,
    updatedAt: 1,
    ...partial,
  }
}

const day: ScheduleItem[] = [
  { id: 'a', date: '2026-10-20', templateId: 't1', order: 1 },
  { id: 'b', date: '2026-10-20', templateId: 't1', order: 0 },
  { id: 'c', date: '2026-10-21', templateId: 't1', order: 0 },
]

const sorted = tasksForDate(day, '2026-10-20')
assert.deepEqual(sorted.map((item) => item.id), ['b', 'a'])

const done: Session = { scheduleId: 'b', status: 'complete', stepIndex: 0, ticks: {}, updatedAt: 1 }
const active: Session = { scheduleId: 'a', status: 'how', stepIndex: 1, ticks: {}, updatedAt: 1 }
const map = new Map<string, Session>([
  ['b', done],
  ['a', active],
])
assert.equal(currentTask(sorted, map)?.id, 'a')
assert.equal(nextOpen(sorted, map, 'b')?.id, 'a')
assert.equal(nextOpen(sorted, new Map([['b', done], ['a', { ...active, status: 'complete' }]]), 'b'), null)

const pack = template()
assert.equal(afterStart(pack).screen, 'how')
assert.equal(afterStart(template({ steps: [], checks: [{ id: 'c1', text: 'Yes' }] })).screen, 'check')
assert.equal(afterStart(template({ steps: [], checks: [] })).screen, 'report')
assert.deepEqual(afterNext(pack, 0), { screen: 'how', stepIndex: 1 })
assert.equal(afterNext(pack, 1).screen, 'check')
assert.equal(afterNext(template({ checks: [] }), 1).screen, 'report')
assert.equal(checksComplete(pack, {}), false)
assert.equal(checksComplete(pack, { c1: true }), true)
assert.deepEqual(move(['a', 'b', 'c'], 0, -1), ['a', 'b', 'c'])
assert.deepEqual(move(['a', 'b', 'c'], 1, -1), ['b', 'a', 'c'])
assert.equal(helpLine('  ', 'Please help'), 'Please help')
assert.equal(doneLine('I packed the box.', 'fallback'), 'I packed the box.')
assert.equal(statusLabel(active, pack), 'On step 2 of 2')
assert.equal(parseBackup({ version: 2 }), null)
assert.equal(parseBackup(null), null)

const salt = 'salt'
const hash = await hashPin(DEMO_PIN, salt)
assert.equal(await hashPin(DEMO_PIN, salt), hash)
assert.equal(safeEqual(hash, hash), true)
assert.equal(safeEqual(hash, hash.slice(0, -1) + '0'), false)

function lum(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16)
  const channel = (value: number) => {
    const s = value / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const r = channel((n >> 16) & 255)
  const g = channel((n >> 8) & 255)
  const b = channel(n & 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string) {
  const left = lum(a)
  const right = lum(b)
  const [hi, lo] = left > right ? [left, right] : [right, left]
  return (hi + 0.05) / (lo + 0.05)
}

assert.ok(contrast('#FFFFFF', '#14532D') >= 7)
assert.ok(contrast('#1C1917', '#F3EEE4') >= 7)
assert.ok(contrast('#3F3830', '#F3EEE4') >= 4.5)
assert.ok(contrast('#6B3A0A', '#F4E4C4') >= 4.5)
assert.ok(contrast('#7F1D1D', '#F3EEE4') >= 4.5)

console.log('flow ok')
