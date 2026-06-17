import { useEffect, useState } from 'react'
import {
  Plus,
  SlidersHorizontal,
  CookingPot,
  Beef,
  IceCream,
  CupSoda,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CalendarDays,
  Boxes,
  X,
  Loader2,
} from 'lucide-react'
import Topbar, { SearchBox, TopIcons, Divider, ProfileChip } from '../layout/Topbar.jsx'
import { supabase } from '../lib/supabase.js'
import { upcomingDates } from '../lib/dates.js'

const tabs = [
  { label: 'Biryani', icon: CookingPot },
  { label: 'Kebabs', icon: Beef },
  { label: 'Desserts', icon: IceCream },
  { label: 'Beverages', icon: CupSoda },
]

const LOW_STOCK_THRESHOLD = 5

/* map a product name to one of our brand dish photos */
function imgFor(name = '', photoUrl) {
  if (photoUrl) return photoUrl
  const n = name.toLowerCase()
  if (n.includes('mutton') || n.includes('korma')) return '/assets/mutton-korma.png'
  if (n.includes('paneer')) return '/assets/paneer-tikka.png'
  if (n.includes('butter')) return '/assets/butter-chicken.png'
  if (n.includes('tikka') || n.includes('aatishi')) return '/assets/chicken-aatishi.png'
  if (n.includes('kebab') || n.includes('galouti')) return '/assets/galouti-kebab.png'
  return '/assets/chicken-biryani.png'
}

function categoryFor(name = '') {
  const n = name.toLowerCase()
  if (n.includes('coffee') || n.includes('lassi') || n.includes('drink') || n.includes('juice'))
    return 'BEVERAGE'
  if (n.includes('brownie') || n.includes('tukda') || n.includes('kheer') || n.includes('dessert'))
    return 'DESSERT'
  if (n.includes('veg') || n.includes('paneer')) return 'VEG'
  return 'MAIN COURSE'
}

function Toggle({ on, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${
        on ? 'bg-brand' : 'bg-line-2'
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:brightness-95'}`}
    >
      <span
        className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

/* ── Modal shell ── */
function Modal({ title, subtitle, onClose, children, footer }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line p-5">
          <div>
            <h3 className="text-lg font-bold text-ink">{title}</h3>
            {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-ink-soft hover:text-ink" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="flex justify-end gap-3 border-t border-line p-5">{footer}</div>}
      </div>
    </div>
  )
}

/* ── Per-date availability editor ──
   Lists the upcoming delivery dates. The restaurant turns OFF the dates the
   dish is NOT available on; those rows are removed from product_availability,
   so the customer app won't offer the dish on those days. */
function AvailabilityModal({ product, dates, onClose, onSaved }) {
  const [available, setAvailable] = useState(null) // Set<iso> | null while loading
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    const from = dates[0].iso
    const to = dates[dates.length - 1].iso
    supabase
      .from('product_availability')
      .select('available_date')
      .eq('product_id', product.id)
      .gte('available_date', from)
      .lte('available_date', to)
      .then(({ data, error }) => {
        if (!alive) return
        if (error) console.error('Failed to load availability:', error.message)
        setAvailable(new Set((data ?? []).map((r) => r.available_date)))
      })
    return () => {
      alive = false
    }
  }, [product.id, dates])

  const toggle = (iso) => {
    setAvailable((prev) => {
      const next = new Set(prev)
      if (next.has(iso)) next.delete(iso)
      else next.add(iso)
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    const { data: existingRows } = await supabase
      .from('product_availability')
      .select('available_date')
      .eq('product_id', product.id)
      .gte('available_date', dates[0].iso)
      .lte('available_date', dates[dates.length - 1].iso)
    const existing = new Set((existingRows ?? []).map((r) => r.available_date))

    const toAdd = [...available].filter((iso) => !existing.has(iso))
    const toRemove = [...existing].filter((iso) => !available.has(iso))

    const permissionMsg =
      'Changes could not be saved — this account may not have permission to edit the menu. ' +
      'Run migration 005 (restaurant role) and sign in again.'

    if (toAdd.length) {
      const { data, error } = await supabase
        .from('product_availability')
        .insert(toAdd.map((iso) => ({ product_id: product.id, available_date: iso })))
        .select('available_date')
      if (error) {
        setSaving(false)
        alert(`Could not update availability: ${error.message}`)
        return
      }
      if ((data?.length ?? 0) === 0) {
        setSaving(false)
        alert(permissionMsg)
        return
      }
    }
    if (toRemove.length) {
      const { data, error } = await supabase
        .from('product_availability')
        .delete()
        .eq('product_id', product.id)
        .in('available_date', toRemove)
        .select('available_date')
      if (error) {
        setSaving(false)
        alert(`Could not update availability: ${error.message}`)
        return
      }
      // RLS silently filters rows the user can't modify: 0 rows back = blocked.
      if ((data?.length ?? 0) === 0) {
        setSaving(false)
        alert(permissionMsg)
        return
      }
    }
    setSaving(false)
    onSaved(new Set(available))
  }

  const offCount = available ? dates.length - dates.filter((d) => available.has(d.iso)).length : 0

  return (
    <Modal
      title={`Availability — ${product.name}`}
      subtitle="Turn off the dates this dish is NOT available."
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-line-soft"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || available === null}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </>
      }
    >
      {available === null ? (
        <div className="flex justify-center py-10 text-ink-soft">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-ink-soft">
            {offCount === 0
              ? 'Available on all upcoming dates.'
              : `Unavailable on ${offCount} of the next ${dates.length} days.`}
          </p>
          <div className="grid max-h-[46vh] grid-cols-2 gap-2 overflow-y-auto pr-1">
            {dates.map((d) => {
              const isOn = available.has(d.iso)
              return (
                <button
                  key={d.iso}
                  onClick={() => toggle(d.iso)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    isOn
                      ? 'border-pos/40 bg-pos-soft'
                      : 'border-brand/40 bg-brand-light'
                  }`}
                >
                  <span>
                    <span className="block text-sm font-semibold text-ink">{d.full}</span>
                    <span
                      className={`block text-[11px] font-medium ${
                        isOn ? 'text-pos' : 'text-brand'
                      }`}
                    >
                      {isOn ? 'Available' : 'Unavailable'}
                    </span>
                  </span>
                  <Toggle on={isOn} onClick={() => toggle(d.iso)} />
                </button>
              )
            })}
          </div>
        </>
      )}
    </Modal>
  )
}

/* ── Add inventory ── */
function StockModal({ product, onClose, onSaved }) {
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const current = product.stock ?? 0
  const add = Math.max(0, parseInt(amount, 10) || 0)
  const next = current + add

  const save = async () => {
    if (add <= 0) return
    setSaving(true)
    const { data, error } = await supabase
      .from('products')
      .update({ stock: next })
      .eq('id', product.id)
      .select('id')
    setSaving(false)
    if (error) {
      alert(`Could not update stock: ${error.message}`)
      return
    }
    if ((data?.length ?? 0) === 0) {
      alert(
        'Stock could not be saved — this account may not have permission to edit the menu. ' +
          'Run migration 005 (restaurant role) and sign in again.'
      )
      return
    }
    onSaved(next)
  }

  return (
    <Modal
      title={`Add inventory — ${product.name}`}
      subtitle={`Current stock: ${current} units`}
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-line-soft"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || add <= 0}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Add {add > 0 ? add : ''} units
          </button>
        </>
      }
    >
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
        Quantity to add
      </label>
      <input
        type="number"
        min={0}
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
        placeholder="0"
        autoFocus
        className="h-11 w-full rounded-lg border border-line bg-surface-low px-3 text-sm text-ink outline-none focus:border-brand"
      />
      <div className="mt-3 flex gap-2">
        {[10, 25, 50].map((n) => (
          <button
            key={n}
            onClick={() => setAmount(String(add + n))}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-line-soft"
          >
            +{n}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-ink-soft">
        New stock total: <span className="font-bold text-ink">{next} units</span>
      </p>
    </Modal>
  )
}

export default function Menu() {
  const [active, setActive] = useState('Biryani')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [availFor, setAvailFor] = useState(null) // product being edited for dates
  const [stockFor, setStockFor] = useState(null) // product being restocked
  const [offDays, setOffDays] = useState({}) // productId -> number of upcoming days unavailable

  const dates = upcomingDates(14)

  const toggleAvailability = async (product) => {
    const next = !product.is_available
    setSavingId(product.id)
    // Optimistic update so the toggle responds instantly.
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, is_available: next } : p))
    )
    const { error } = await supabase
      .from('products')
      .update({ is_available: next })
      .eq('id', product.id)
    setSavingId(null)
    if (error) {
      console.error('Failed to update availability:', error.message)
      alert(`Could not update availability: ${error.message}`)
      // Roll back on failure.
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_available: !next } : p))
      )
    }
  }

  useEffect(() => {
    let alive = true
    const from = dates[0].iso
    const to = dates[dates.length - 1].iso
    Promise.all([
      supabase.from('products').select('*').order('price', { ascending: false }),
      supabase
        .from('product_availability')
        .select('product_id, available_date')
        .gte('available_date', from)
        .lte('available_date', to),
    ]).then(([prodRes, availRes]) => {
      if (!alive) return
      if (prodRes.error) console.error('Failed to load products:', prodRes.error.message)
      const prods = prodRes.data ?? []
      setProducts(prods)

      // Count how many of the upcoming days each product is available, then
      // off-days = total upcoming days − available days.
      const availCount = {}
      for (const row of availRes.data ?? []) {
        availCount[row.product_id] = (availCount[row.product_id] || 0) + 1
      }
      const off = {}
      for (const p of prods) off[p.id] = dates.length - (availCount[p.id] || 0)
      setOffDays(off)
      setLoading(false)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pad = (n) => String(n).padStart(2, '0')
  const stockOf = (p) => p.stock ?? 0

  const activeCount = products.filter((p) => p.is_available).length
  const inactiveCount = products.filter((p) => !p.is_available).length
  const inStock = products.filter((p) => stockOf(p) > LOW_STOCK_THRESHOLD).length
  const lowStock = products.filter((p) => stockOf(p) > 0 && stockOf(p) <= LOW_STOCK_THRESHOLD).length
  const soldOut = products.filter((p) => stockOf(p) === 0).length

  const avgPrice = products.length
    ? Math.round(products.reduce((s, p) => s + (p.price || 0), 0) / products.length)
    : 0
  const categoryCount = new Set(products.map((p) => categoryFor(p.name))).size

  const perf = [
    { label: 'TOTAL DISHES', value: String(products.length), sub: 'On the menu', subTone: 'text-ink-soft' },
    { label: 'ACTIVE', value: pad(activeCount), sub: `${pad(inactiveCount)} inactive`, subTone: 'text-pos' },
    { label: 'AVG. PRICE', value: `₹${avgPrice}`, sub: `${categoryCount} categories`, subTone: 'text-ink-soft' },
  ]

  const stock = [
    { label: 'In Stock', count: pad(inStock), icon: CheckCircle2, tone: 'text-pos', bg: 'bg-pos-soft' },
    { label: 'Low Stock', count: pad(lowStock), icon: AlertTriangle, tone: 'text-[#fbbf24]', bg: 'bg-[#3a2a10]' },
    { label: 'Sold Out', count: pad(soldOut), icon: XCircle, tone: 'text-brand', bg: 'bg-brand-light' },
  ]

  return (
    <>
      <Topbar>
        <SearchBox placeholder="Search dishes, prices, or categories..." className="w-full max-w-[420px]" />
        <div className="flex items-center gap-1">
          <TopIcons />
          <Divider />
          <ProfileChip name="Spice Route - Downtown" sub="Main Hub" initials="SR" />
        </div>
      </Topbar>

      <div className="space-y-6 p-8">
        {/* header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] font-bold leading-8 text-ink">Menu Management</h1>
            <p className="mt-2 text-base text-ink-soft">
              Organize your culinary offerings, update pricing, inventory, and date availability.
            </p>
          </div>
          <button className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-white hover:bg-brand-dark">
            <Plus className="h-4 w-4" /> Add New Dish
          </button>
        </div>

        {/* table card */}
        <div className="rounded-xl border border-line bg-surface">
          {/* tabs */}
          <div className="flex items-center justify-between border-b border-line px-5">
            <div className="flex items-center gap-6">
              {tabs.map((t) => {
                const isActive = active === t.label
                return (
                  <button
                    key={t.label}
                    onClick={() => setActive(t.label)}
                    className={`flex items-center gap-2 border-b-2 py-4 text-sm font-semibold transition-colors ${
                      isActive
                        ? 'border-brand text-brand'
                        : 'border-transparent text-ink-soft hover:text-ink'
                    }`}
                  >
                    <t.icon className="h-4 w-4" /> {t.label}
                  </button>
                )
              })}
            </div>
            <button className="text-ink-soft">
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>

          {/* table */}
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                <th className="px-5 py-3 font-semibold">Dish Details</th>
                <th className="px-5 py-3 font-semibold">Category</th>
                <th className="px-5 py-3 font-semibold">Price</th>
                <th className="px-5 py-3 font-semibold">Stock</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Dates</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-ink-soft">
                    Loading dishes…
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-ink-soft">
                    No dishes found.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const s = stockOf(p)
                  const stockTone =
                    s === 0 ? 'text-brand' : s <= LOW_STOCK_THRESHOLD ? 'text-[#fbbf24]' : 'text-ink'
                  const off = offDays[p.id] || 0
                  return (
                    <tr key={p.id}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={imgFor(p.name, p.photo_url)}
                            alt=""
                            className="h-12 w-12 rounded-lg bg-line-2 object-cover"
                          />
                          <div>
                            <p className="text-sm font-semibold text-ink">{p.name}</p>
                            <p className="max-w-[240px] truncate text-xs text-ink-soft">
                              {p.description || '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded bg-[#2a2410] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gold">
                          {categoryFor(p.name)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-ink">₹{p.price}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${stockTone}`}>{s}</span>
                          <button
                            onClick={() => setStockFor(p)}
                            className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[11px] font-semibold text-ink-soft hover:bg-line-soft"
                          >
                            <Boxes className="h-3.5 w-3.5" /> Add
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Toggle
                          on={p.is_available}
                          disabled={savingId === p.id}
                          onClick={() => toggleAvailability(p)}
                        />
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setAvailFor(p)}
                          className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[11px] font-semibold text-ink-soft hover:bg-line-soft"
                        >
                          <CalendarDays className="h-3.5 w-3.5" />
                          {off === 0 ? 'All dates' : `${off} day${off > 1 ? 's' : ''} off`}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-right text-ink-soft">⋯</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>

          {/* footer */}
          <div className="flex items-center justify-between p-5">
            <span className="text-sm text-ink-soft">
              {loading ? 'Loading…' : `Showing ${products.length} of ${products.length} dishes`}
            </span>
            <div className="flex items-center gap-1 text-sm">
              <button className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-soft">
                ‹
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded-md bg-brand font-semibold text-white">
                1
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-soft">
                ›
              </button>
            </div>
          </div>
        </div>

        {/* bottom */}
        <div className="grid grid-cols-[1fr_360px] gap-6">
          {/* menu performance */}
          <div className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-base font-bold text-ink">Menu Performance</h2>
            <div className="mt-4 grid grid-cols-3 gap-4">
              {perf.map((p) => (
                <div key={p.label} className="rounded-xl bg-line-soft p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                    {p.label}
                  </p>
                  <p className="mt-2 text-lg font-bold text-ink">{p.value}</p>
                  <p className={`mt-1 flex items-center gap-1 text-xs font-semibold ${p.subTone}`}>
                    {p.icon ? <p.icon className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                    {p.sub}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* stock overview */}
          <div className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-base font-bold text-ink">Stock Overview</h2>
            <div className="mt-4 space-y-3">
              {stock.map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-ink">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full ${s.bg} ${s.tone}`}>
                      <s.icon className="h-4 w-4" />
                    </span>
                    {s.label}
                  </span>
                  <span className="text-sm font-bold text-ink">{s.count}</span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-center text-xs text-ink-soft">
              Stock reduces automatically as orders come in.
            </p>
          </div>
        </div>
      </div>

      {availFor && (
        <AvailabilityModal
          product={availFor}
          dates={dates}
          onClose={() => setAvailFor(null)}
          onSaved={(availableSet) => {
            const off = dates.length - dates.filter((d) => availableSet.has(d.iso)).length
            setOffDays((prev) => ({ ...prev, [availFor.id]: off }))
            setAvailFor(null)
          }}
        />
      )}

      {stockFor && (
        <StockModal
          product={stockFor}
          onClose={() => setStockFor(null)}
          onSaved={(newStock) => {
            setProducts((prev) =>
              prev.map((p) => (p.id === stockFor.id ? { ...p, stock: newStock } : p))
            )
            setStockFor(null)
          }}
        />
      )}
    </>
  )
}
