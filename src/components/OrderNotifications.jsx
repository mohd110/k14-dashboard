import { useEffect, useState } from 'react'
import { BellRing, X } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

let toastSeq = 0

/* ── Loud, repeating new-order alarm (rings for 1 minute) ──────────────
 * Mimics a classic telephone ring (dual 440 + 480 Hz tones, 2s ring / 1s
 * pause cadence) at near-max volume so staff can't miss an incoming order.
 * Best-effort: silently skipped if the browser blocks audio. Call
 * stopAlarm() to silence it early. */
const ALARM_DURATION_MS = 60_000
let alarmCtx = null
let alarmInterval = null
let alarmTimeout = null

function stopAlarm() {
  if (alarmInterval) {
    clearInterval(alarmInterval)
    alarmInterval = null
  }
  if (alarmTimeout) {
    clearTimeout(alarmTimeout)
    alarmTimeout = null
  }
  if (alarmCtx) {
    try {
      alarmCtx.close()
    } catch {
      /* already closed */
    }
    alarmCtx = null
  }
}

function startAlarm() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    stopAlarm() // restart cleanly if another order arrives mid-alarm
    const ctx = new Ctx()
    alarmCtx = ctx
    ctx.resume?.()

    const tone = (freq, t0, dur) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine' // smoother, phone-like
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(0.85, t0 + 0.01) // very loud
      gain.gain.setValueAtTime(0.85, t0 + dur - 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
      osc.start(t0)
      osc.stop(t0 + dur)
    }

    // One "ring" = the classic telephone double-tone (440 + 480 Hz) buzzing
    // for ~2s. Phones use a 2s-on / 4s-off cadence; we shorten the gap so it
    // feels urgent in a busy kitchen.
    const ring = () => {
      if (!alarmCtx) return
      const now = ctx.currentTime
      tone(440, now, 2)
      tone(480, now, 2)
    }

    ring()
    alarmInterval = setInterval(ring, 3000) // ~2s ring + ~1s pause
    alarmTimeout = setTimeout(stopAlarm, ALARM_DURATION_MS)
  } catch {
    /* audio not available — silently skip */
  }
}

/* Listens for new orders in real time and shows toast notifications. */
export default function OrderNotifications() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const dismiss = (id) => setToasts((list) => list.filter((t) => t.id !== id))

    const channel = supabase
      .channel('new-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          const o = payload.new || {}
          const addr = o.delivery_address || {}
          const id = ++toastSeq
          const toast = {
            id,
            code: o.id ? `ORD-${String(o.id).slice(0, 4).toUpperCase()}` : 'New order',
            total: typeof o.total === 'number' ? o.total : null,
            name: addr.name || 'New customer',
          }
          setToasts((list) => [toast, ...list].slice(0, 4))
          startAlarm()
          // Keep the toast visible for the full alarm so staff can silence it.
          setTimeout(() => dismiss(id), ALARM_DURATION_MS)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      stopAlarm()
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed right-6 top-6 z-50 flex w-80 flex-col gap-3">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface p-4 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand">
            <BellRing className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">New order received</p>
            <p className="mt-0.5 truncate text-xs text-ink-soft">
              {t.code}
              {t.total != null ? ` · ₹${t.total.toLocaleString('en-IN')}` : ''} · {t.name}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-brand">Tap ✕ to silence alarm</p>
          </div>
          <button
            onClick={() => {
              stopAlarm()
              setToasts((list) => list.filter((x) => x.id !== t.id))
            }}
            className="shrink-0 text-ink-soft hover:text-ink"
            aria-label="Dismiss and silence alarm"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
