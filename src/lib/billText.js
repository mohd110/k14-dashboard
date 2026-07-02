// Plain-text customer bill for WhatsApp (free wa.me click-to-chat, no API).
//
// When staff approve a 40% advance in the dashboard we auto-open WhatsApp
// with this bill pre-filled to the customer's number. It mirrors the KOT
// header (BMT / house mark / store) and adds prices + paid/unpaid amounts.

import { BMT_NAME, HOUSE_MARK, POWERED_BY, storeNameFor } from './kotPdf.js'

const rupee = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

/** Build the multi-line bill text for one order. */
export function billText(o, stores) {
  const addr = o.delivery_address || {}
  const items = o.order_items || []
  const store = storeNameFor(o, stores)
  const code = o.order_code || `ORD-${String(o.id).slice(0, 4).toUpperCase()}`

  const total = Number(o.total || 0)
  // Advance is the 40% already collected; balance is what's left to pay.
  const paid = Number(o.advance_amount ?? Math.round(total * 0.4))
  const balance = Math.max(0, total - paid)

  const lines = []
  lines.push(`*${BMT_NAME}*`)
  lines.push(HOUSE_MARK)
  lines.push(`*${store.toUpperCase()}*`)
  lines.push('— — — BILL — — —')
  lines.push(`Order: ${code}`)
  if (addr.date) lines.push(`Date: ${addr.date}${addr.time ? ` · ${addr.time}` : ''}`)
  if (addr.name) lines.push(`Customer: ${addr.name}`)
  lines.push('')

  items.forEach((it) => {
    const name = it.products?.name || 'Item'
    const qty = it.quantity ?? 1
    const price = Number(it.price_at_order ?? 0)
    const lineTotal = price * qty
    lines.push(`${name}  ${qty} × ${rupee(price)} = ${rupee(lineTotal)}`)
  })

  lines.push('- - - - - - - - - - - -')
  lines.push(`Total:        ${rupee(total)}`)
  lines.push(`Paid (40%):   ${rupee(paid)}`)
  lines.push(`Balance due:  ${rupee(balance)}`)
  lines.push('')
  lines.push(`${HOUSE_MARK} · ${POWERED_BY}`)

  return lines.join('\n')
}

/** wa.me click-to-chat URL with the bill pre-filled. Returns null if no phone. */
export function whatsappBillUrl(o, stores) {
  const addr = o.delivery_address || {}
  const raw = String(addr.phone || '').replace(/\D/g, '')
  if (!raw) return null
  // Default Indian country code when the number is a bare 10-digit mobile.
  const phone = raw.length === 10 ? `91${raw}` : raw
  return `https://wa.me/${phone}?text=${encodeURIComponent(billText(o, stores))}`
}
