// Kitchen Order Ticket (KOT) → printable PDF.
//
// We deliberately avoid a PDF dependency: a print window renders a thermal
// receipt-style ticket and the browser's print dialog lets staff "Save as PDF"
// (or send straight to a kitchen printer). Works for a single accepted order
// or a whole day's worth of orders (one ticket per page).

function fmtDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = String(iso).split('-').map(Number)
  if (!y || !m || !d) return String(iso)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  )

/* One ticket (one order). */
function ticketHtml(o) {
  const addr = o.delivery_address || {}
  const items = o.order_items || []
  const code = o.order_code || `ORD-${String(o.id).slice(0, 4).toUpperCase()}`
  const rows = items
    .map((it) => {
      const name = it.products?.name || 'Item'
      const qty = it.quantity ?? 1
      return `<tr>
        <td class="q">${esc(qty)}×</td>
        <td class="n">${esc(name)}</td>
      </tr>`
    })
    .join('')

  const totalQty = items.reduce((s, it) => s + (it.quantity || 0), 0)

  return `<section class="ticket">
    <div class="head">
      <div class="brand">K14 BAKERS</div>
      <div class="sub">KITCHEN ORDER TICKET</div>
    </div>
    <div class="meta">
      <div class="code">${esc(code)}</div>
      <div class="row"><span>Order date</span><b>${fmtDate(addr.date)}</b></div>
      ${addr.time ? `<div class="row"><span>Time</span><b>${esc(addr.time)}</b></div>` : ''}
      <div class="row"><span>Type</span><b>${addr.fulfillment === 'delivery' ? 'Home Delivery' : 'Store Pickup'}</b></div>
      ${addr.name ? `<div class="row"><span>Customer</span><b>${esc(addr.name)}</b></div>` : ''}
      ${addr.phone ? `<div class="row"><span>Phone</span><b>${esc(addr.phone)}${addr.alt_phone ? ` / ${esc(addr.alt_phone)}` : ''}</b></div>` : ''}
      ${addr.store ? `<div class="row"><span>Store</span><b>${esc(addr.store)}</b></div>` : ''}
      ${addr.packing && addr.packing !== 'none' ? `<div class="row"><span>Packing</span><b>${esc(addr.packing_label || addr.packing)}${addr.packing_fee ? ` (₹${addr.packing_fee})` : ''}</b></div>` : ''}
    </div>
    <table class="items">
      <thead><tr><th class="q">Qty</th><th class="n">Item</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="2" class="muted">No items</td></tr>'}</tbody>
    </table>
    <div class="totals">
      <div class="row big"><span>Total items</span><b>${totalQty}</b></div>
    </div>
    ${o.note ? `<div class="note">📝 ${esc(o.note)}</div>` : ''}
    <div class="foot">Printed ${new Date().toLocaleString('en-IN')}</div>
  </section>`
}

function documentHtml(orders, { title = 'KOT', heading } = {}) {
  const tickets = orders.map(ticketHtml).join('')
  return `<!doctype html><html><head><meta charset="utf-8"/>
  <title>${esc(title)}</title>
  <style>
    @page { size: 80mm auto; margin: 6mm; }
    * { box-sizing: border-box; }
    body { font-family: "Courier New", ui-monospace, monospace; color: #000; background: #fff; margin: 0; }
    .day-head { text-align:center; font-weight:700; padding:6px 0 10px; border-bottom:2px dashed #000; margin-bottom:10px; }
    .ticket { width: 72mm; margin: 0 auto 10mm; page-break-after: always; }
    .ticket:last-child { page-break-after: auto; }
    .head { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; }
    .brand { font-size: 20px; font-weight: 800; letter-spacing: 2px; }
    .sub { font-size: 11px; letter-spacing: 2px; margin-top: 2px; }
    .meta { padding: 8px 0; border-bottom: 1px dashed #000; }
    .code { font-size: 14px; font-weight: 800; text-align: center; margin-bottom: 6px; }
    .row { display: flex; justify-content: space-between; font-size: 12px; padding: 1px 0; gap: 8px; }
    .row span { color: #333; }
    .row b { text-align: right; }
    table.items { width: 100%; border-collapse: collapse; margin: 6px 0; }
    table.items th { font-size: 10px; text-align: left; border-bottom: 1px solid #000; padding: 3px 2px; }
    table.items td { font-size: 12px; padding: 3px 2px; vertical-align: top; }
    table.items th.a, table.items td.a { text-align: right; }
    table.items td.q { width: 34px; font-weight: 700; }
    .muted { color: #777; text-align: center; }
    .totals { border-top: 1px dashed #000; padding-top: 6px; }
    .totals .big { font-size: 15px; font-weight: 800; border-top: 1px solid #000; margin-top: 4px; padding-top: 4px; }
    .note { margin-top: 8px; border: 1px solid #000; padding: 6px; font-size: 12px; }
    .foot { text-align: center; font-size: 10px; color: #555; margin-top: 8px; }
  </style></head>
  <body>
    ${heading ? `<div class="day-head">${esc(heading)}</div>` : ''}
    ${tickets || '<p style="text-align:center">No orders.</p>'}
  </body></html>`
}

/**
 * Open the print dialog for one order or a list of orders.
 * @param {object|object[]} orders  a single order or an array
 * @param {{ title?: string, heading?: string }} opts
 */
export function printKot(orders, opts = {}) {
  const list = Array.isArray(orders) ? orders : [orders]
  if (list.length === 0) return
  const html = documentHtml(list, opts)
  const w = window.open('', '_blank', 'width=420,height=720')
  if (!w) {
    alert('Please allow pop-ups for this site to save the KOT as a PDF.')
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
  const fire = () => {
    try {
      w.focus()
      w.print()
    } catch {
      /* user closed the window */
    }
  }
  // Print once content has laid out; onload is most reliable, with a fallback.
  w.onload = fire
  setTimeout(fire, 500)
}
