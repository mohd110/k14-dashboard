// Date helpers for per-date menu availability.
// Availability is managed for delivery dates from tomorrow onward.

const pad = (n) => String(n).padStart(2, '0')

/** Local calendar date as YYYY-MM-DD (no timezone shift, unlike toISOString). */
export function toIso(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function describe(d) {
  const weekday = d.toLocaleDateString('en-IN', { weekday: 'short' })
  const month = d.toLocaleDateString('en-IN', { month: 'short' })
  const day = pad(d.getDate())
  return { iso: toIso(d), weekday, month, day, full: `${weekday}, ${day} ${month}` }
}

/** Earliest manageable date (tomorrow) as YYYY-MM-DD. */
export function minMenuIso(startOffset = 1) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + startOffset)
  return toIso(d)
}

/** Upcoming dates starting `startOffset` days from today. */
export function upcomingDates(count = 14, startOffset = 1) {
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  const out = []
  for (let i = 0; i < count; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + startOffset + i)
    out.push(describe(d))
  }
  return out
}
