import { jsPDF } from 'jspdf'

const naira = (v) => '\u20A6' + Number(v || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

function drawGeneratedStamp(doc, cx, cy, companyName, r = 12) {
  doc.setDrawColor(0, 100, 40); doc.setLineWidth(0.8)
  doc.circle(cx, cy, r)
  doc.setLineWidth(0.3); doc.circle(cx, cy, r - 2)
  doc.setFontSize(4); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 100, 40)
  const short = companyName.length > 18 ? companyName.slice(0, 18) : companyName
  doc.text(short.toUpperCase(), cx, cy - r + 4.5, { align: 'center' })
  doc.setFontSize(9); doc.text('\u2605', cx, cy + 2.5, { align: 'center' })
  doc.setFontSize(3.5); doc.text('OFFICIAL STAMP', cx, cy + r - 3, { align: 'center' })
  doc.setTextColor(0, 0, 0)
}

export async function generateRepaymentCard({ loan, client, settings, stampDataUrl, scheduleRows }) {
  // A5 landscape: 210mm wide x 148mm tall
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' })
  const W = 210, H = 148
  const margin = 10

  const companyName   = settings?.site_name     || 'FTI Loan Services'
  const companyAddr   = settings?.site_address  || 'Abuja, Nigeria'
  const companyEmail  = settings?.site_email    || 'info@ftiloan.com'
  const companyPhone  = settings?.site_phone    || ''
  const directorName  = settings?.director_name || 'The Director'
  const clientName    = `${client?.first_name || ''} ${client?.last_name || ''}`.trim()
  const perInstalment = loan.total_repayment / Math.max(1, loan.duration_value)

  // Build schedule rows if not provided
  let rows = scheduleRows || []
  if (!rows.length) {
    const dVal  = Number(loan.duration_value)
    const dType = loan.duration_type || 'monthly'
    const start = new Date(loan.created_at)
    if (dType === 'daily') start.setDate(start.getDate() + 3)
    for (let i = 1; i <= dVal; i++) {
      const d = new Date(start)
      if (dType === 'daily')       d.setDate(start.getDate() + i)
      else if (dType === 'weekly') d.setDate(start.getDate() + i * 7)
      else                         d.setMonth(start.getMonth() + i)
      rows.push({ installment_no: i, due_date: d.toISOString(), amount_due: perInstalment, amount_paid: 0, status: 'pending' })
    }
  }

  // ── Header bar ──────────────────────────────────────────────────────────
  doc.setFillColor(0, 100, 40); doc.rect(0, 0, W, 16, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(255, 255, 255)
  doc.text(companyName.toUpperCase(), margin, 9)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5)
  doc.text(`${companyAddr}  |  ${companyEmail}${companyPhone ? '  |  ' + companyPhone : ''}`, margin, 14)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  doc.text('REPAYMENT CARD', W - margin, 9, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
  doc.text(loan.loan_ref, W - margin, 14, { align: 'right' })
  doc.setTextColor(0, 0, 0)

  // ── Client & loan info strip ────────────────────────────────────────────
  let y = 21
  doc.setFillColor(245, 250, 245); doc.rect(margin, y, W - margin * 2, 18, 'F')
  doc.setDrawColor(180, 210, 180); doc.rect(margin, y, W - margin * 2, 18)

  // Left column
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(60, 60, 60)
  doc.text('BORROWER', margin + 3, y + 5)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(0, 0, 0)
  doc.text(clientName, margin + 3, y + 10)
  doc.setFontSize(7); doc.setTextColor(80, 80, 80)
  doc.text(client?.phone || '—', margin + 3, y + 15)

  // Middle column
  const mid = W / 2 - 20
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(60, 60, 60)
  doc.text('LOAN AMOUNT', mid, y + 5)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0, 100, 40)
  doc.text(naira(loan.amount), mid, y + 11)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(80, 80, 80)
  doc.text(`${loan.duration_value} ${loan.duration_type} instalments`, mid, y + 16)

  // Right column
  const right = W - margin - 50
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(60, 60, 60)
  doc.text('TOTAL REPAYABLE', right, y + 5)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(200, 80, 0)
  doc.text(naira(loan.total_repayment), right, y + 11)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(80, 80, 80)
  doc.text(`${naira(perInstalment)} per ${loan.duration_type?.replace(/ly$/, '')}`, right, y + 16)

  doc.setTextColor(0, 0, 0)
  y += 22

  // ── Minimum payment notice ──────────────────────────────────────────────
  doc.setFillColor(255, 251, 235); doc.rect(margin, y, W - margin * 2, 6, 'F')
  doc.setDrawColor(230, 190, 80); doc.rect(margin, y, W - margin * 2, 6)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(120, 80, 0)
  doc.text(`\u26A0  Minimum instalment: ${naira(perInstalment)}. You may pay more — any extra reduces your next instalment.`, margin + 3, y + 4)
  doc.setTextColor(0, 0, 0)
  y += 9

  // ── Payment table ───────────────────────────────────────────────────────
  const cols     = ['#', 'Due Date', 'Amount Due', 'Amount Paid', 'Date Paid', 'Balance', 'Status', 'Officer']
  const colWidths = [8, 26, 24, 24, 24, 22, 18, 20]
  const tableW   = colWidths.reduce((a, b) => a + b, 0)
  const tableX   = (W - tableW) / 2

  // Header row
  doc.setFillColor(0, 100, 40); doc.rect(tableX, y, tableW, 7, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(255, 255, 255)
  let cx = tableX
  cols.forEach((col, i) => {
    doc.text(col, cx + colWidths[i] / 2, y + 4.5, { align: 'center' })
    cx += colWidths[i]
  })
  doc.setTextColor(0, 0, 0)
  y += 7

  // Data rows — max 20 rows (A5 landscape fits ~14-16 cleanly)
  const maxRows = Math.min(rows.length, 18)
  rows.slice(0, maxRows).forEach((row, idx) => {
    const bg = idx % 2 === 0 ? [255, 255, 255] : [245, 250, 245]
    doc.setFillColor(...bg)
    doc.rect(tableX, y, tableW, 6.5, 'F')
    doc.setDrawColor(220, 235, 220)
    doc.line(tableX, y + 6.5, tableX + tableW, y + 6.5)

    const balance = Math.max(0, Number(row.amount_due) - Number(row.amount_paid || 0))
    const cells = [
      String(idx + 1),
      fmtDate(row.due_date),
      naira(row.amount_due),
      row.amount_paid > 0 ? naira(row.amount_paid) : '',
      row.paid_at ? fmtDate(row.paid_at) : '',
      balance > 0 ? naira(balance) : naira(0),
      (row.status || 'pending').toUpperCase().slice(0, 7),
      '',  // Officer — blank for manual fill
    ]

    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5)
    cx = tableX
    cells.forEach((cell, i) => {
      // Colour status column
      if (i === 6) {
        if (row.status === 'paid')    doc.setTextColor(0, 130, 0)
        else if (row.status === 'overdue') doc.setTextColor(200, 0, 0)
        else if (row.status === 'partial') doc.setTextColor(180, 100, 0)
        else doc.setTextColor(100, 100, 100)
      }
      doc.text(cell, cx + colWidths[i] / 2, y + 4.3, { align: 'center' })
      doc.setTextColor(0, 0, 0)
      cx += colWidths[i]
    })

    // Vertical column dividers
    cx = tableX
    doc.setDrawColor(220, 235, 220); doc.setLineWidth(0.2)
    colWidths.forEach(w => { cx += w; doc.line(cx, y, cx, y + 6.5) })

    y += 6.5
  })

  // Table border
  doc.setDrawColor(150, 200, 150); doc.setLineWidth(0.5)
  doc.rect(tableX, y - 6.5 * maxRows - 7, tableW, 6.5 * maxRows + 7)

  if (rows.length > maxRows) {
    y += 2
    doc.setFontSize(6.5); doc.setTextColor(120, 120, 120)
    doc.text(`Note: Showing first ${maxRows} of ${rows.length} instalments. Full schedule available on the portal.`, tableX, y)
    doc.setTextColor(0, 0, 0)
    y += 5
  } else {
    y += 4
  }

  // ── Stamp + footer line ──────────────────────────────────────────────────
  // Only draw stamp/footer if we have space
  if (y < H - 18) {
    // Stamp bottom right
    const stampX = W - margin - 16
    const stampY = H - margin - 12
    if (stampDataUrl) {
      try { doc.addImage(stampDataUrl, 'PNG', stampX - 12, stampY - 12, 22, 22) }
      catch { drawGeneratedStamp(doc, stampX, stampY, companyName, 12) }
    } else {
      drawGeneratedStamp(doc, stampX, stampY, companyName, 12)
    }

    // Footer divider
    doc.setDrawColor(0, 100, 40); doc.setLineWidth(0.3)
    doc.line(margin, H - 10, W - margin - 30, H - 10)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(100, 100, 100)
    doc.text(`${companyName}  |  ${loan.loan_ref}  |  Issued: ${fmtDate(new Date().toISOString())}`, margin, H - 6)
    doc.text('This card is the official record of repayments. Keep it safe.', margin, H - 3)
  }

  return doc
}

export function downloadRepaymentCard(doc, loanRef) {
  doc.save(`FTILoan-RepaymentCard-${loanRef}.pdf`)
}
