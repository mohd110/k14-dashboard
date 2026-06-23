import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  FileDown,
  Printer,
  Check,
  X,
  Clock,
  Phone,
  Hash,
  CalendarDays,
} from 'lucide-react'
import Topbar, { SearchBox, TopIcons } from '../layout/Topbar.jsx'
import { supabase } from '../lib/supabase.js'
import { toIso } from '../lib/dates.js'
import { printKot } from '../lib/kotPdf.js'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/* Status pill styling for the KOT cards. */
const STATUS = {
  pending: { label: 'New / Pending', bg: 'bg-[#fef3c7]', text: 'text-[#b45309]', dot: 'bg-[#f59e0b]' },
  accepted: { label: 'Accepted', bg: 'bg-info-soft', text: 'text-info', dot: 'bg-info' },
  preparing: { label: 'Preparing', bg: 'bg-[#fef3c7]', text: 'text-[#b45309]', dot: 'bg-[#f59e0b]' },
  ready: { label: 'Ready', bg: 'bg-pos-soft', text: 'text-pos-dark', dot: 'bg-pos' },
  rejected: { label: 'Rejected', bg: 'bg-[#fee2e2]', text: 'text-[#dc2626]', dot: 'bg-[#ef4444]' },
}

function fmtLongDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/* ── A single Kitchen Order Ticket card in the right panel ── */
function KotCard({ order, onAccept, onReject, busy }) {
  const addr = order.delivery_address || {}
  const items = order.order_items || []
  const code = order.order_code || `ORD-${String(order.id).slice(0, 4).toUpperCase()}`
  const s = STATUS[order.status] || STATUS.pending
  const isPending = order.status === 'pending'
  const totalQty = items.reduce((sum, it) => sum + (it.quantity || 0), 0)

  return (
    <div
      className={`rounded-xl border bg-surface-low p-4 ${
        isPending ? 'border-brand shadow-[0_0_0_1px_var(--color-brand)]' : 'border-line'
      }`}
    >
      {/* ticket header */}
      <div className="flex items-start justify-between gap-2 border-b border-dashed border-line pb-3">
        <div>
          <p className="flex items-center gap-1.5 font-mono text-sm font-bold text-ink">
            <Hash className="h-3.5 w-3.5 text-brand" />
            {code}
          </p>
          <p className="mt-1 text-xs text-ink-soft">{addr.name || 'Customer'}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.bg} ${s.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} /> {s.label}
        </span>
      </div>

      {/* meta */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 py-2 text-xs text-ink-soft">
        {addr.time && (
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {addr.time}
          </span>
        )}
        {addr.phone && (
          <span className="flex items-center gap-1">
            <Phone className="h-3.5 w-3.5" /> {addr.phone}
          </span>
        )}
        <span>{addr.fulfillment === 'delivery' ? 'Home Delivery' : 'Store Pickup'}</span>
      </div>

      {/* items */}
      <div className="divide-y divide-line-soft border-y border-line">
        {items.length === 0 ? (
          <p className="py-2 text-xs text-ink-soft">No items</p>
        ) : (
          items.map((it, i) => {
            const qty = it.quantity ?? 1
            return (
              <div key={i} className="flex items-center gap-2 py-1.5 text-sm">
                <span className="w-9 shrink-0 font-bold text-brand">{qty}×</span>
                <span className="flex-1 truncate text-ink">{it.products?.name || 'Item'}</span>
              </div>
            )
          })
        )}
      </div>

      {/* item count */}
      <div className="flex justify-between pt-2 text-sm font-semibold text-ink">
        <span>Total items</span>
        <span>{totalQty}</span>
      </div>

      {order.note && (
        <p className="mt-2 rounded-md bg-[#fef3c7] px-2 py-1 text-xs text-[#b45309]">📝 {order.note}</p>
      )}

      {/* actions */}
      <div className="mt-3 flex items-center gap-2">
        {isPending ? (
          <>
            <button
              onClick={() => onAccept(order)}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-pos px-3 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-60"
            >
              <Check className="h-4 w-4" /> Accept &amp; Print KOT
            </button>
            <button
              onClick={() => onReject(order)}
              disabled={busy}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-[#dc2626] hover:bg-[#fee2e2] disabled:opacity-60"
            >
              <X className="h-4 w-4" /> Reject
            </button>
          </>
        ) : (
          <button
            onClick={() => printKot(order, { title: code })}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-line-soft"
          >
            <Printer className="h-4 w-4" /> Print KOT
          </button>
        )}
      </div>
    </div>
  )
}

export default function Calendar() {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const todayIso = toIso(today)

  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedIso, setSelectedIso] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(() => {
    return supabase
      .from('orders')
      .select('*, order_items(quantity, price_at_order, products(name, price))')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('Failed to load orders:', error.message)
        setOrders(data ?? [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('calendar-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  // Group orders by their requested delivery/pickup date (YYYY-MM-DD).
  const byDate = useMemo(() => {
    const map = new Map()
    for (const o of orders) {
      const iso = o.delivery_address?.date
      if (!iso) continue
      if (!map.has(iso)) map.set(iso, [])
      map.get(iso).push(o)
    }
    // sort each day's orders by time then code
    for (const list of map.values()) {
      list.sort((a, b) =>
        String(a.delivery_address?.time || '').localeCompare(String(b.delivery_address?.time || '')) ||
        String(a.order_code || '').localeCompare(String(b.order_code || ''))
      )
    }
    return map
  }, [orders])

  // Default day (when the user hasn't picked one): today if it has orders,
  // else the soonest upcoming day with orders, else the latest, else today.
  const defaultIso = useMemo(() => {
    if (byDate.has(todayIso)) return todayIso
    const all = [...byDate.keys()].sort()
    const upcoming = all.filter((iso) => iso >= todayIso)
    return upcoming[0] || all[all.length - 1] || todayIso
  }, [byDate, todayIso])

  const activeIso = selectedIso || defaultIso

  // Build the month grid (leading/trailing blanks to fill whole weeks).
  const cells = useMemo(() => {
    const year = view.getFullYear()
    const month = view.getMonth()
    const firstWeekday = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const out = []
    for (let i = 0; i < firstWeekday; i++) out.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = toIso(new Date(year, month, d))
      const dayOrders = byDate.get(iso) || []
      out.push({
        day: d,
        iso,
        count: dayOrders.length,
        hasNew: dayOrders.some((o) => o.status === 'pending'),
        isToday: iso === todayIso,
      })
    }
    while (out.length % 7 !== 0) out.push(null)
    return out
  }, [view, byDate, todayIso])

  const selectedOrders = byDate.get(activeIso) || []
  const monthLabel = view.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  const setStatus = async (order, status) => {
    setBusyId(order.id)
    const { error } = await supabase.from('orders').update({ status }).eq('id', order.id)
    setBusyId(null)
    if (error) {
      alert(`Could not update order: ${error.message}`)
      return false
    }
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)))
    return true
  }

  const handleAccept = async (order) => {
    const ok = await setStatus(order, 'accepted')
    if (ok) printKot({ ...order, status: 'accepted' }, { title: order.order_code || 'KOT' })
  }

  const handleReject = async (order) => {
    if (!window.confirm(`Reject order ${order.order_code || ''}? This cannot be undone here.`)) return
    await setStatus(order, 'rejected')
  }

  const handleDayKot = () => {
    if (selectedOrders.length === 0) return
    printKot(selectedOrders, {
      title: `Day KOT ${activeIso}`,
      heading: `K14 BAKERS · ${fmtLongDate(activeIso)} · ${selectedOrders.length} order${
        selectedOrders.length === 1 ? '' : 's'
      }`,
    })
  }

  const goMonth = (delta) =>
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1))

  return (
    <>
      <Topbar>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-ink">Calendar</h1>
          <span className="flex items-center gap-1.5 rounded-full bg-brand-light px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" /> Live Orders
          </span>
        </div>
        <div className="flex items-center gap-2">
          <SearchBox placeholder="Search orders..." className="w-[220px]" />
          <TopIcons />
          <button
            onClick={handleDayKot}
            disabled={selectedOrders.length === 0}
            className="ml-1 flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" /> Day KOT (PDF)
          </button>
        </div>
      </Topbar>

      <div className="grid grid-cols-[1fr_400px] gap-6 p-8">
        {/* ── Calendar ── */}
        <div className="rounded-xl border border-line bg-surface p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-ink">{monthLabel}</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goMonth(-1)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-soft hover:bg-line-soft"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView(new Date(today.getFullYear(), today.getMonth(), 1))}
                className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-soft hover:bg-line-soft"
              >
                Today
              </button>
              <button
                onClick={() => goMonth(1)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-soft hover:bg-line-soft"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {WEEKDAYS.map((w) => (
              <div key={w} className="pb-2 text-center text-xs font-semibold uppercase tracking-wide text-ink-soft">
                {w}
              </div>
            ))}
            {cells.map((cell, i) => {
              if (!cell) return <div key={`b${i}`} className="aspect-square rounded-lg bg-line-soft/30" />
              const selected = cell.iso === activeIso
              return (
                <button
                  key={cell.iso}
                  onClick={() => setSelectedIso(cell.iso)}
                  className={`relative flex aspect-square flex-col items-center justify-start rounded-lg border p-2 text-left transition-colors ${
                    selected
                      ? 'border-brand bg-brand-light'
                      : cell.count > 0
                        ? 'border-line bg-surface-low hover:border-brand/60'
                        : 'border-line-soft hover:bg-line-soft'
                  } ${cell.hasNew ? 'k14-blink' : ''}`}
                >
                  <span
                    className={`text-sm font-semibold ${
                      cell.isToday ? 'flex h-6 w-6 items-center justify-center rounded-full bg-ink text-surface' : 'text-ink'
                    }`}
                  >
                    {cell.day}
                  </span>
                  {cell.count > 0 && (
                    <span
                      className={`mt-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        cell.hasNew ? 'bg-brand text-white' : 'bg-info-soft text-info'
                      }`}
                    >
                      {cell.count} order{cell.count === 1 ? '' : 's'}
                    </span>
                  )}
                  {cell.hasNew && (
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand" />
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-ink-soft">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand" /> New / pending order</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-info" /> Has orders</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-ink" /> Today</span>
          </div>
        </div>

        {/* ── KOT panel ── */}
        <div className="flex max-h-[calc(100vh-8rem)] flex-col rounded-xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line p-5">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
                <CalendarDays className="h-5 w-5 text-brand" /> KOT
              </h2>
              <p className="mt-0.5 text-xs text-ink-soft">
                {activeIso ? fmtLongDate(activeIso) : 'Select a day'}
              </p>
            </div>
            {selectedOrders.length > 0 && (
              <span className="rounded-full bg-line-soft px-2.5 py-1 text-xs font-semibold text-ink-soft">
                {selectedOrders.length} order{selectedOrders.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {loading ? (
              <p className="py-12 text-center text-sm text-ink-soft">Loading orders…</p>
            ) : selectedOrders.length === 0 ? (
              <p className="py-12 text-center text-sm text-ink-soft">
                No orders for this day.
              </p>
            ) : (
              selectedOrders.map((o) => (
                <KotCard
                  key={o.id}
                  order={o}
                  busy={busyId === o.id}
                  onAccept={handleAccept}
                  onReject={handleReject}
                />
              ))
            )}
          </div>

          {selectedOrders.length > 0 && (
            <div className="border-t border-line p-5">
              <button
                onClick={handleDayKot}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                <FileDown className="h-4 w-4" /> Save day-wise KOT ({selectedOrders.length}) as PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
