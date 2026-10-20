import { putPhoto, saveSettings, saveTemplate, getSettings, replaceDay } from './db'
import { todayKey, uid } from './flow'
import { DEMO_PIN, hashPin } from './pin'
import type { Template } from './types'

const SAMPLE_PHOTOS: Record<string, string> = {
  'pic-bench': 'bench.svg',
  'pic-box': 'box.svg',
  'pic-line': 'line.svg',
  'pic-hold': 'hold.svg',
  'pic-in': 'in-box.svg',
  'pic-fold': 'fold.svg',
  'pic-find': 'find.svg',
  'pic-name': 'name.svg',
  'pic-press': 'press.svg',
}

function step(text: string, photoId: string, alt: string) {
  return { id: uid(), text, photoId, alt }
}

function check(text: string) {
  return { id: uid(), text }
}

function templates(now: number): Template[] {
  return [
    {
      id: 'tpl-bench',
      title: 'Get the bench ready',
      helpPhrase: '',
      donePhrase: 'The bench is ready.',
      archived: false,
      updatedAt: now,
      steps: [
        step('Look at the bench. Move anything that is not for this task.', 'pic-bench', 'An empty bench.'),
        step('Put the box in the middle of the bench.', 'pic-box', 'A box in the middle of the bench.'),
        step('Put the items in a line next to the box.', 'pic-line', 'Three items in a line.'),
      ],
      checks: [
        check('The bench has only what I need'),
        check('The box is in the middle'),
        check('The items are in a line'),
      ],
    },
    {
      id: 'tpl-pack',
      title: 'Pack one box',
      helpPhrase: '',
      donePhrase: 'I packed the box.',
      archived: false,
      updatedAt: now,
      steps: [
        step('Pick up one item.', 'pic-hold', 'One item held above the bench.'),
        step('Put the item inside the box.', 'pic-in', 'An item inside an open box.'),
        step('Fold the top of the box down.', 'pic-fold', 'A box with the top folded down.'),
      ],
      checks: [check('The item is inside'), check('The top is folded down')],
    },
    {
      id: 'tpl-label',
      title: 'Check the label',
      helpPhrase: '',
      donePhrase: 'I checked the label.',
      archived: false,
      updatedAt: now,
      steps: [
        step('Find the label.', 'pic-find', 'A label on the front of a box.'),
        step('Point to the name on the label.', 'pic-name', 'A label with lines for the name.'),
        step('Press the label so it stays flat.', 'pic-press', 'A finger pressing a label flat.'),
      ],
      checks: [check('I can see the name'), check('The label is flat')],
    },
  ]
}

async function storeSamples(): Promise<void> {
  await Promise.all(
    Object.entries(SAMPLE_PHOTOS).map(async ([id, file]) => {
      try {
        const res = await fetch(`/samples/${file}`)
        if (!res.ok) return
        const blob = await res.blob()
        await putPhoto(id, blob)
      } catch {
        // The task still works if a sample picture is missing.
      }
    }),
  )
}

let seeding: Promise<void> | null = null

export function ensureSeed(): Promise<void> {
  if (!seeding) {
    seeding = seedOnce().catch((error) => {
      seeding = null
      throw error
    })
  }
  return seeding
}

async function seedOnce(): Promise<void> {
  const existing = await getSettings()
  if (existing) return
  const salt = crypto.randomUUID()
  const now = Date.now()
  await storeSamples()
  for (const template of templates(now)) await saveTemplate(template)
  const date = todayKey()
  await replaceDay(date, [
    { id: uid(), date, templateId: 'tpl-bench', order: 0 },
    { id: uid(), date, templateId: 'tpl-pack', order: 1 },
    { id: uid(), date, templateId: 'tpl-label', order: 2 },
  ])
  await saveSettings({
    siteName: 'Station',
    pinHash: await hashPin(DEMO_PIN, salt),
    pinSalt: salt,
    pinIsDefault: true,
    helpPhrase: 'Please can you help me with this step?',
    donePhrase: 'I have finished this task.',
  })
}
