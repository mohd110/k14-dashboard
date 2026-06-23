import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ClipboardList,
  ChefHat,
  CheckCircle2,
  TrendingUp,
  Truck,
  SlidersHorizontal,
  Download,
  Hash,
  ChevronRight,
  ChevronDown,
  Check,
} from 'lucide-react'
import Topbar, { SearchBox, TopIcons } from '../layout/Topbar.jsx'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/AuthContext.jsx'

/* map dish name -> brand photo */
function imgFor(name = '') {
  const n = name.toLowerCase()
  if (n.includes('mutton') || n.includes('korma')) return '/assets/mutton-korma.png'
  if (n.includes('paneer')) return '/assets/paneer-tikka.png'
  if (n.includes('butter')) return '/assets/butter-chicken.png'
  if (n.includes('tikka') || n.includes('aatishi')) return '/assets/chicken-aatishi.png'
  if (n.includes('kebab') || n.includes('galouti')) return '/assets/galouti-kebab.png'
  return '/assets/chicken-biryani.png'
}

function elapsed(iso) {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ${min % 60}m`
  return `${Math.floor(hr / 24)}d`
}

/* status values allowed by the DB CHECK constraint, in workflow order */
const STATUS = {
  pending: { label: 'Pending', bg: 'bg-line-soft', text: 'text-ink-soft', dot: 'bg-ink-soft' },
  accepted: { label: 'Accepted', bg: 'bg-info-soft', text: 'text-info', dot: 'bg-info' },
  preparing: { label: 'Preparing', bg: 'bg-[#fef3c7]', text: 'text-[#b45309]', dot: 'bg-[#f59e0b]' },
  ready: { label: 'Ready', bg: 'bg-pos-soft', text: 'text-pos-dark', dot: 'bg-pos' },
  rejected: { label: 'Rejected', bg: 'bg-[#fee2e2]', text: 'text-[#dc2626]', dot: 'bg-[#ef4444]' },
}
const STATUS_KEYS = Object.keys(STATUS)

/* advance-payment verification states (orders.payment_status) */
const PAYMENT = {
  awaiting_verification: { label: 'Unverified', bg: 'bg-[#fef3c7]', text: 'text-[#b45309]', dot: 'bg-[#f59e0b]' },
  paid: { label: 'Paid', bg: 'bg-pos-soft', text: 'text-pos-dark', dot: 'bg-pos' },
  failed: { label: 'Rejected', bg: 'bg-[#fee2e2]', text: 'text-[#dc2626]', dot: 'bg-[#ef4444]' },
}
const PAYMENT_KEYS = Object.keys(PAYMENT)

/* Clickable payment pill — verify or reject the customer's 40% advance. */
function PaymentSelect({ order, onChange }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef(null)
  const p = PAYMENT[order.payment_status] ?? PAYMENT.awaiting_verification

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const pick = async (payment_status) => {
    setOpen(false)
    if (payment_status === order.payment_status) return
    setSaving(true)
    const { error } = await supabase.from('orders').update({ payment_status }).eq('id', order.id)
    setSaving(false)
    if (error) {
      console.error('Failed to update payment:', error.message)
      alert(`Could not update payment: ${error.message}`)
      return
    }
    onChange(order.id, payment_status)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${p.bg} ${p.text} ${
          saving ? 'opacity-60' : 'hover:brightness-95'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} /> {p.label}
        <ChevronDown className="h-3 w-3 opacity-70" />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 w-44 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
          {PAYMENT_KEYS.map((key) => {
            const v = PAYMENT[key]
            const current = key === order.payment_status
            return (
              <button
                key={key}
                type="button"
                onClick={() => pick(key)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-line-soft ${
                  current ? 'text-ink' : 'text-ink-soft'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${v.dot}`} /> {v.label}
                {current && <Check className="ml-auto h-3.5 w-3.5 text-brand" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* Clickable status pill — opens a menu to move an order through the workflow. */
function StatusSelect({ order, onChange }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef(null)
  const s = STATUS[order.status] ?? STATUS.pending

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const pick = async (status) => {
    setOpen(false)
    if (status === order.status) return
    setSaving(true)
    const { error } = await supabase.from('orders').update({ status }).eq('id', order.id)
    setSaving(false)
    if (error) {
      console.error('Failed to update status:', error.message)
      alert(`Could not update status: ${error.message}`)
      return
    }
    onChange(order.id, status)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${s.bg} ${s.text} ${
          saving ? 'opacity-60' : 'hover:brightness-95'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} /> {s.label}
        <ChevronDown className="h-3 w-3 opacity-70" />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 w-44 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
          {STATUS_KEYS.map((key) => {
            const v = STATUS[key]
            const current = key === order.status
            return (
              <button
                key={key}
                type="button"
                onClick={() => pick(key)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-line-soft ${
                  current ? 'text-ink' : 'text-ink-soft'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${v.dot}`} /> {v.label}
                {current && <Check className="ml-auto h-3.5 w-3.5 text-brand" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, sub, icon: Icon, iconBg }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-[28px] font-bold leading-none text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink-soft">{sub}</p>
    </div>
  )
}

export default function Orders() {
  const { role } = useAuth()
  const isBakery = role === 'bakery'
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    return supabase
      .from('orders')
      .select('*, order_items(quantity, products(name, photo_url))')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('Failed to load orders:', error.message)
        setOrders(data ?? [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    load()
    // Live-refresh the table whenever any order is inserted/updated/deleted.
    const channel = supabase
      .channel('orders-table')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  const updateStatus = (id, status) =>
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)))

  const updatePayment = (id, payment_status) =>
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, payment_status } : o)))

  const inKitchen = orders.filter((o) => ['accepted', 'preparing'].includes(o.status)).length
  const ready = orders.filter((o) => o.status === 'ready').length
  const potential = orders.reduce((sum, o) => sum + (o.total || 0), 0)

  const kpis = [
    { label: 'TOTAL ACTIVE', value: String(orders.length), sub: 'All live orders', icon: ClipboardList, iconBg: 'bg-brand-light text-brand' },
    { label: 'IN KITCHEN', value: String(inKitchen), sub: 'Accepted + preparing', icon: ChefHat, iconBg: 'bg-[#fef3c7] text-[#b45309]' },
    { label: 'READY', value: String(ready), sub: 'Awaiting pickup', icon: CheckCircle2, iconBg: 'bg-pos-soft text-pos-dark' },
    // Revenue is hidden from bakery staff.
    ...(isBakery
      ? []
      : [{ label: 'POTENTIAL REV.', value: `₹${potential.toLocaleString('en-IN')}`, sub: 'Real-time valuation', icon: TrendingUp, iconBg: 'bg-info-soft text-info' }]),
  ]

  return (
    <>
      <Topbar>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-ink">Order Monitoring</h1>
          <span className="flex items-center gap-1.5 rounded-full bg-brand-light px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" /> Live Status
          </span>
        </div>
        <div className="flex items-center gap-2">
          <SearchBox placeholder="Search orders..." className="w-[260px]" />
          <TopIcons />
          <button className="ml-1 flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink">
            <Truck className="h-4 w-4 text-ink-soft" /> Global Fleet
            <ChevronRight className="h-3.5 w-3.5 rotate-90 text-ink-soft" />
          </button>
        </div>
      </Topbar>

      <div className="space-y-6 p-8">
        {/* KPIs */}
        <div className={`grid gap-6 ${isBakery ? 'grid-cols-3' : 'grid-cols-4'}`}>
          {kpis.map((k) => (
            <Kpi key={k.label} {...k} />
          ))}
        </div>

        {/* table */}
        <div className="rounded-xl border border-line bg-surface">
          <div className="flex items-center justify-between p-5">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-ink">Active Orders</h2>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink">
                <SlidersHorizontal className="h-4 w-4" /> Filters
              </button>
              <button className="flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
                <Download className="h-4 w-4" /> Export Log
              </button>
            </div>
          </div>

          <table className="w-full text-left">
            <thead>
              <tr className="border-y border-line text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                <th className="px-5 py-3 font-semibold">Order ID</th>
                <th className="px-5 py-3 font-semibold">Customer</th>
                <th className="px-5 py-3 font-semibold">Items</th>
                <th className="px-5 py-3 font-semibold">Total Price</th>
                <th className="px-5 py-3 font-semibold">Advance Payment</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Time Elapsed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-ink-soft">Loading orders…</td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-ink-soft">No active orders.</td>
                </tr>
              ) : (
                orders.map((o) => {
                  const items = o.order_items ?? []
                  const addr = o.delivery_address ?? {}
                  return (
                    <tr key={o.id}>
                      <td className="px-5 py-4">
                        <span className="flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-line-soft text-ink-soft">
                            <Hash className="h-3.5 w-3.5" />
                          </span>
                          <span className="font-mono text-xs font-semibold text-brand">
                            {o.order_code || `ORD-${o.id.slice(0, 4).toUpperCase()}`}
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-ink">{addr.name || 'Customer'}</p>
                        {addr.phone && (
                          <p className="text-xs text-ink-soft">
                            {addr.phone}
                            {addr.alt_phone ? ` · alt ${addr.alt_phone}` : ''}
                          </p>
                        )}
                        {(addr.fulfillment || addr.date || addr.time) && (
                          <p className="text-xs text-ink-soft">
                            {addr.fulfillment === 'delivery' ? 'Home Delivery' : 'Store Pickup'}
                            {addr.date ? ` · ${addr.date}` : ''}
                            {addr.time ? ` · ${addr.time}` : ''}
                          </p>
                        )}
                        <p className="max-w-[200px] truncate text-xs text-ink-soft">{addr.address || '—'}</p>
                        {o.note && (
                          <p className="mt-1 max-w-[220px] rounded-md bg-[#fef3c7] px-2 py-1 text-xs text-[#b45309]">
                            📝 {o.note}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="flex items-center gap-2">
                          <span className="flex -space-x-2">
                            {items.slice(0, 2).map((it, i) => (
                              <img
                                key={i}
                                src={imgFor(it.products?.name)}
                                alt=""
                                className="h-7 w-7 rounded-full border-2 border-white bg-line-2 object-cover"
                              />
                            ))}
                          </span>
                          <span className="text-xs text-ink-soft">
                            {items.length === 1 ? '1 item' : `${items.length} items`}
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-ink">₹{o.total}</td>
                      <td className="px-5 py-4">
                        <PaymentSelect order={o} onChange={updatePayment} />
                        <p className="mt-1 flex items-center gap-2 text-xs text-ink-soft">
                          <span>₹{o.advance_amount ?? 0} advance</span>
                          {o.payment_proof_url ? (
                            <a
                              href={o.payment_proof_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-gold underline underline-offset-2 hover:text-brand"
                            >
                              View screenshot
                            </a>
                          ) : o.payment_ref ? (
                            <span>· UTR {o.payment_ref}</span>
                          ) : null}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <StatusSelect order={o} onChange={updateStatus} />
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-semibold text-ink-soft">
                        {elapsed(o.created_at)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>

          <div className="flex items-center justify-between p-5">
            <span className="text-sm text-ink-soft">
              {loading ? 'Loading…' : `Showing ${orders.length} order${orders.length === 1 ? '' : 's'}`}
            </span>
            <div className="flex items-center gap-1 text-sm">
              <button className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-soft">‹</button>
              <button className="flex h-8 w-8 items-center justify-center rounded-md bg-brand font-semibold text-white">1</button>
              <button className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-soft">›</button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
