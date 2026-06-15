import { useEffect, useMemo, useState } from 'react'
import { Users, Mail, Phone, ShoppingBag, IndianRupee } from 'lucide-react'
import Topbar, { SearchBox, TopIcons } from '../layout/Topbar.jsx'
import { supabase } from '../lib/supabase.js'

function initialsOf(name = '', email = '') {
  const src = (name || email || '?').trim()
  const parts = src.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

function joinedLabel(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
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

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [stats, setStats] = useState({}) // id -> { orders, spent }
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let alive = true
    async function load() {
      const [{ data: profiles, error: pErr }, { data: orders, error: oErr }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, phone, created_at, role')
          .eq('role', 'customer')
          .order('created_at', { ascending: false }),
        supabase.from('orders').select('customer_id, total'),
      ])
      if (!alive) return
      if (pErr) console.error('Failed to load customers:', pErr.message)
      if (oErr) console.error('Failed to load orders:', oErr.message)

      const agg = {}
      ;(orders ?? []).forEach((o) => {
        if (!o.customer_id) return
        const s = agg[o.customer_id] ?? { orders: 0, spent: 0 }
        s.orders += 1
        s.spent += o.total || 0
        agg[o.customer_id] = s
      })
      setStats(agg)
      setCustomers(profiles ?? [])
      setLoading(false)
    }
    load()
    return () => {
      alive = false
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) =>
      [c.full_name, c.email, c.phone].some((v) => (v || '').toLowerCase().includes(q))
    )
  }, [customers, query])

  const totalSpent = customers.reduce((s, c) => s + (stats[c.id]?.spent || 0), 0)
  const withOrders = customers.filter((c) => (stats[c.id]?.orders || 0) > 0).length

  const kpis = [
    { label: 'TOTAL CUSTOMERS', value: String(customers.length), sub: 'Registered profiles', icon: Users, iconBg: 'bg-brand-light text-brand' },
    { label: 'WITH ORDERS', value: String(withOrders), sub: 'Have placed an order', icon: ShoppingBag, iconBg: 'bg-info-soft text-info' },
    { label: 'TOTAL SPENT', value: `₹${totalSpent.toLocaleString('en-IN')}`, sub: 'Across all customers', icon: IndianRupee, iconBg: 'bg-pos-soft text-pos-dark' },
  ]

  return (
    <>
      <Topbar>
        <h1 className="text-xl font-bold text-ink">Customer Management</h1>
        <div className="flex items-center gap-2">
          <SearchBox
            placeholder="Search by name, email, or phone..."
            className="w-[280px]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <TopIcons />
        </div>
      </Topbar>

      <div className="space-y-6 p-8">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-6">
          {kpis.map((k) => (
            <Kpi key={k.label} {...k} />
          ))}
        </div>

        {/* table */}
        <div className="rounded-xl border border-line bg-surface">
          <div className="flex items-center justify-between p-5">
            <h2 className="text-lg font-bold text-ink">All Customers</h2>
          </div>

          <table className="w-full text-left">
            <thead>
              <tr className="border-y border-line text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                <th className="px-5 py-3 font-semibold">Customer</th>
                <th className="px-5 py-3 font-semibold">Contact</th>
                <th className="px-5 py-3 font-semibold">Orders</th>
                <th className="px-5 py-3 font-semibold">Total Spent</th>
                <th className="px-5 py-3 text-right font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-ink-soft">Loading customers…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-ink-soft">
                    {query ? 'No customers match your search.' : 'No customers found.'}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const s = stats[c.id] ?? { orders: 0, spent: 0 }
                  return (
                    <tr key={c.id}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-sm font-bold text-brand">
                            {initialsOf(c.full_name, c.email)}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-ink">{c.full_name || 'Customer'}</p>
                            <p className="max-w-[200px] truncate text-xs text-ink-soft">{c.email || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="flex items-center gap-1.5 text-xs text-ink-soft">
                          <Mail className="h-3.5 w-3.5" /> {c.email || '—'}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
                          <Phone className="h-3.5 w-3.5" /> {c.phone || '—'}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-ink">{s.orders}</td>
                      <td className="px-5 py-4 text-sm font-semibold text-ink">₹{s.spent.toLocaleString('en-IN')}</td>
                      <td className="px-5 py-4 text-right text-sm text-ink-soft">{joinedLabel(c.created_at)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>

          <div className="flex items-center justify-between p-5">
            <span className="text-sm text-ink-soft">
              {loading ? 'Loading…' : `Showing ${filtered.length} customer${filtered.length === 1 ? '' : 's'}`}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
