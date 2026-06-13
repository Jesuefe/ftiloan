import { jsPDF } from 'jspdf'

const naira = (v) => '\u20A6' + Number(v || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-NG') : '—'

function drawGeneratedStamp(doc, cx, cy, companyName, directorName, r = 18) {
  doc.setDrawColor(0, 100, 40); doc.setLineWidth(1.2)
  doc.circle(cx, cy, r)
  doc.setLineWidth(0.4); doc.circle(cx, cy, r - 2.5)
  doc.setFontSize(5); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 100, 40)
  const short = companyName.length > 22 ? companyName.slice(0, 22) : companyName
  doc.text(short.toUpperCase(), cx, cy - r + 5.5, { align: 'center' })
  doc.setFontSize(11); doc.text('\u2605', cx, cy + 3, { align: 'center' })
  doc.setFontSize(4.5); doc.text(directorName.toUpperCase(), cx, cy + r - 4, { align: 'center' })
  doc.setTextColor(0, 0, 0)
}

function drawGeneratedSignature(doc, x, y, name, w = 48) {
  doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(15); doc.setTextColor(0, 30, 120)
  const sig = name.trim().split(' ').map(p => p[0]).join('. ') + '.'
  doc.text(sig, x, y + 7)
  doc.setDrawColor(0, 30, 120); doc.setLineWidth(0.5)
  doc.line(x, y + 9, x + w, y + 9)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(80, 80, 80)
  doc.text(name, x, y + 13)
  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal')
}

// Line writer helper — auto word-wraps and returns new y
function writePara(doc, text, x, y, maxW, lineH = 5) {
  const lines = doc.splitTextToSize(text, maxW)
  doc.text(lines, x, y)
  return y + lines.length * lineH
}

function sectionTitle(doc, text, x, y, contentW) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(0, 100, 40)
  doc.text(text, x, y)
  doc.setDrawColor(0, 100, 40); doc.setLineWidth(0.3)
  doc.line(x, y + 1.5, x + contentW, y + 1.5)
  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
  return y + 6
}

function fieldRow(doc, label, value, x, y, labelW = 52) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(80, 80, 80)
  doc.text(label, x, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(0, 0, 0)
  const lines = doc.splitTextToSize(String(value || '—'), 130)
  doc.text(lines, x + labelW, y)
  return y + Math.max(5, lines.length * 4.8)
}

function checkNewPage(doc, y, margin = 20, threshold = 265) {
  if (y > threshold) { doc.addPage(); return margin }
  return y
}

// ─────────────────────────────────────────────────────────────────────────────
export async function generateLoanAgreement({ loan, client, settings, guarantor, stampDataUrl, sigDataUrl }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, margin = 20, contentW = W - margin * 2
  let y = 0

  const companyName   = settings?.site_name     || 'FTI Loan Services'
  const companyAddr   = settings?.site_address  || 'Abuja, Nigeria'
  const companyEmail  = settings?.site_email    || 'info@ftiloan.com'
  const companyPhone  = settings?.site_phone    || ''
  const directorName  = settings?.director_name || 'The Director'
  const directorTitle = settings?.director_title || 'Managing Director'
  const jurisdiction  = 'Federal Republic of Nigeria'

  const clientName  = `${client?.first_name || ''} ${client?.last_name || ''}`.trim()
  const clientDOB   = client?.date_of_birth ? fmtDate(client.date_of_birth) : '—'
  const clientAddr  = client?.residential_address || '—'
  const clientEmail = client?.email || '—'
  const clientPhone = client?.phone || '—'
  const clientID    = client?.nin_number ? `NIN: ${client.nin_number.slice(0,4)}*****` : (client?.bvn_number ? `BVN: ${client.bvn_number.slice(0,4)}*****` : '—')

  const isAsset       = loan.loan_type === 'asset'
  const perInstalment = loan.total_repayment / Math.max(1, loan.duration_value)
  const schedRows     = loan.repayment_schedule || []
  const firstDue      = schedRows.length ? fmtDate(schedRows[0].due_date) : '—'
  const lastDue       = schedRows.length ? fmtDate(schedRows[schedRows.length - 1].due_date) : '—'
  const agreementDate = fmtDate(loan.created_at)
  const disbDate      = loan.disbursed_at ? fmtDate(loan.disbursed_at) : fmtDate(loan.created_at)
  const acceptedAt    = fmtDateTime(loan.created_at)

  // ── Header ─────────────────────────────────────────────────────────────
  doc.setFillColor(0, 100, 40)
  doc.rect(0, 0, W, 22, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(255, 255, 255)
  doc.text(companyName.toUpperCase(), margin, 12)
  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal')
  doc.text(`${companyAddr}  |  ${companyEmail}${companyPhone ? '  |  ' + companyPhone : ''}`, margin, 18)
  doc.setTextColor(0, 0, 0)
  y = 30

  // ── Title ──────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
  doc.text('LOAN AGREEMENT', W / 2, y, { align: 'center' })
  y += 5
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 100, 100)
  doc.text(`Ref: ${loan.loan_ref}   |   Date: ${agreementDate}   |   Type: ${isAsset ? 'Asset Loan' : 'Cash Loan'}`, W / 2, y, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  y += 4

  doc.setDrawColor(0, 100, 40); doc.setLineWidth(0.6)
  doc.line(margin, y, W - margin, y)
  y += 7

  // ── Intro para ─────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
  y = writePara(doc,
    `This Loan Agreement ("Agreement") is entered into on ${agreementDate} between ${companyName} (the "Lender") and ${clientName} (the "Borrower"), collectively referred to as the "Parties".`,
    margin, y, contentW)
  y += 5

  // ── 1. Parties ─────────────────────────────────────────────────────────
  y = sectionTitle(doc, '1. PARTIES', margin, y, contentW)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text('Lender:', margin, y); y += 5
  doc.setFont('helvetica', 'normal')
  y = fieldRow(doc, 'Name:', companyName, margin + 4, y)
  y = fieldRow(doc, 'Registered Address:', companyAddr, margin + 4, y)
  y = fieldRow(doc, 'Email:', companyEmail, margin + 4, y)
  if (companyPhone) y = fieldRow(doc, 'Phone:', companyPhone, margin + 4, y)
  y += 3

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text('Borrower:', margin, y); y += 5
  doc.setFont('helvetica', 'normal')
  y = fieldRow(doc, 'Full Name:', clientName, margin + 4, y)
  y = fieldRow(doc, 'Date of Birth:', clientDOB, margin + 4, y)
  y = fieldRow(doc, 'Residential Address:', clientAddr, margin + 4, y)
  y = fieldRow(doc, 'Email:', clientEmail, margin + 4, y)
  y = fieldRow(doc, 'Phone:', clientPhone, margin + 4, y)
  y = fieldRow(doc, 'Government ID:', clientID, margin + 4, y)
  y += 5

  // ── 2. Loan Details ────────────────────────────────────────────────────
  y = checkNewPage(doc, y)
  y = sectionTitle(doc, '2. LOAN DETAILS', margin, y, contentW)
  y = fieldRow(doc, 'Loan Reference Number:', loan.loan_ref, margin, y)
  y = fieldRow(doc, 'Principal Loan Amount:', naira(loan.amount), margin, y)
  y = fieldRow(doc, 'Loan Purpose:', loan.purpose || (isAsset ? `Asset: ${loan.asset_name}` : 'General purpose'), margin, y)
  y = fieldRow(doc, 'Date of Disbursement:', disbDate, margin, y)
  y = fieldRow(doc, 'Loan Term:', `${loan.duration_value} ${loan.duration_type} instalments`, margin, y)
  y = fieldRow(doc, 'Interest Rate:', `${loan.interest_rate}% ${isAsset ? 'flat (asset loan)' : 'per month'}`, margin, y)
  y = fieldRow(doc, 'Total Amount Repayable:', naira(loan.total_repayment), margin, y)
  if (isAsset) {
    y = fieldRow(doc, 'Asset Name:', loan.asset_name || '—', margin, y)
    y = fieldRow(doc, 'Asset Vendor:', `${loan.asset_vendor_name || '—'}, ${loan.asset_vendor_location || '—'}`, margin, y)
  }
  y += 5

  // ── 3. Repayment Schedule ──────────────────────────────────────────────
  y = checkNewPage(doc, y)
  y = sectionTitle(doc, '3. REPAYMENT SCHEDULE', margin, y, contentW)
  y = fieldRow(doc, 'Repayment Frequency:', loan.duration_type?.charAt(0).toUpperCase() + loan.duration_type?.slice(1), margin, y)
  y = fieldRow(doc, 'Number of Instalments:', String(loan.duration_value), margin, y)
  y = fieldRow(doc, 'Instalment Amount:', `${naira(perInstalment)} per ${loan.duration_type?.replace(/ly$/, '')}`, margin, y)
  y = fieldRow(doc, 'First Payment Due Date:', firstDue, margin, y)
  y = fieldRow(doc, 'Final Payment Due Date:', lastDue, margin, y)
  y += 3
  doc.setFontSize(8.5)
  y = writePara(doc, 'Payments shall be made through the payment methods approved by the Lender. Minimum payment per instalment is as stated above. Any overpayment will be credited to the next instalment automatically.', margin, y, contentW)
  y += 5

  // ── 4. Fees and Charges ────────────────────────────────────────────────
  y = checkNewPage(doc, y)
  y = sectionTitle(doc, '4. FEES AND CHARGES', margin, y, contentW)
  y = fieldRow(doc, 'Processing / Admin Fee:', naira(loan.admin_charge), margin, y)
  y = fieldRow(doc, 'Amount Disbursed to Borrower:', naira(loan.disbursed_amount), margin, y)
  y = fieldRow(doc, 'Late Payment Fee:', 'As determined by Lender policy', margin, y)
  y = fieldRow(doc, 'Default Charges:', 'Interest continues to accrue on overdue amounts', margin, y)
  y += 3
  y = writePara(doc, 'All fees shall be clearly disclosed before loan acceptance. The Borrower acknowledges and agrees to the charges stated above.', margin, y, contentW)
  y += 5

  // ── 5. Borrower's Representations ─────────────────────────────────────
  y = checkNewPage(doc, y)
  y = sectionTitle(doc, '5. BORROWER\'S REPRESENTATIONS', margin, y, contentW)
  const reps = [
    'a. All information provided is true, accurate, and complete.',
    'b. The Borrower has full legal capacity to enter into this Agreement.',
    'c. The Borrower shall use the loan for lawful purposes only.',
    'd. The Borrower understands and accepts all obligations under this Agreement.',
    'e. The Borrower has not concealed any material information that may affect the Lender\'s decision.',
  ]
  reps.forEach(r => {
    y = writePara(doc, r, margin, y, contentW)
    y += 1.5
  })
  y += 4

  // ── 6. Early Repayment ─────────────────────────────────────────────────
  y = checkNewPage(doc, y)
  y = sectionTitle(doc, '6. EARLY REPAYMENT', margin, y, contentW)
  y = writePara(doc, 'The Borrower may repay the outstanding loan balance in full before the maturity date. Early repayment is permitted at any time. The Borrower shall notify the Lender at least 3 business days in advance. Interest will be calculated only on the outstanding principal at the time of settlement.', margin, y, contentW)
  y += 5

  // ── 7. Events of Default ──────────────────────────────────────────────
  y = checkNewPage(doc, y)
  y = sectionTitle(doc, '7. EVENTS OF DEFAULT', margin, y, contentW)
  y = writePara(doc, 'The following constitute an event of default:', margin, y, contentW); y += 1.5
  const defaults = [
    '\u2022 Failure to make repayments when due.',
    '\u2022 Provision of false or misleading information.',
    '\u2022 Breach of any provision of this Agreement.',
    '\u2022 Insolvency, bankruptcy, or inability to repay debts.',
  ]
  defaults.forEach(d => { y = writePara(doc, d, margin + 3, y, contentW - 3); y += 1 })
  y += 2
  y = writePara(doc, 'Upon default, the Lender may exercise all rights permitted under applicable law, including acceleration of the full outstanding balance.', margin, y, contentW)
  y += 5

  // ── 8. Collection Activities ───────────────────────────────────────────
  y = checkNewPage(doc, y)
  y = sectionTitle(doc, '8. COLLECTION ACTIVITIES', margin, y, contentW)
  y = writePara(doc, 'Where payments become overdue, the Lender may undertake lawful collection activities including sending reminders through approved communication channels, contacting the Borrower regarding outstanding obligations, and reporting defaults to authorised credit reporting agencies where permitted by law. All collection activities shall comply with applicable consumer protection laws.', margin, y, contentW)
  y += 5

  // ── 9. Data Protection ─────────────────────────────────────────────────
  y = checkNewPage(doc, y)
  y = sectionTitle(doc, '9. DATA PROTECTION AND PRIVACY', margin, y, contentW)
  y = writePara(doc, 'The Borrower consents to the collection, processing, storage, and use of personal information for the purposes of loan assessment, identity verification, fraud prevention, loan administration, and regulatory compliance. The Lender shall process personal information in accordance with applicable data protection laws of Nigeria.', margin, y, contentW)
  y += 5

  // ── 10. Governing Law ──────────────────────────────────────────────────
  y = checkNewPage(doc, y)
  y = sectionTitle(doc, '10. GOVERNING LAW', margin, y, contentW)
  y = writePara(doc, `This Agreement shall be governed by and construed in accordance with the laws of the ${jurisdiction}. Any disputes arising from this Agreement shall be resolved through the courts or dispute resolution mechanisms having jurisdiction in ${jurisdiction}.`, margin, y, contentW)
  y += 5

  // ── 11. Electronic Acceptance ──────────────────────────────────────────
  y = checkNewPage(doc, y)
  y = sectionTitle(doc, '11. ELECTRONIC ACCEPTANCE', margin, y, contentW)
  y = writePara(doc, 'The Parties agree that electronic signatures, digital acceptance, and other electronic methods of consent shall have the same legal effect as handwritten signatures to the extent permitted by applicable law.', margin, y, contentW)
  y += 3
  y = fieldRow(doc, 'Date and Time of Acceptance:', acceptedAt, margin, y)
  y = fieldRow(doc, 'Loan Reference:', loan.loan_ref, margin, y)
  y += 5

  // ── 12. Entire Agreement ───────────────────────────────────────────────
  y = checkNewPage(doc, y)
  y = sectionTitle(doc, '12. ENTIRE AGREEMENT', margin, y, contentW)
  y = writePara(doc, 'This Agreement constitutes the entire understanding between the Parties concerning the Loan and supersedes all prior discussions or representations relating thereto. Any amendment must be in writing and signed by both Parties.', margin, y, contentW)
  y += 8

  // ── Signature Block ────────────────────────────────────────────────────
  y = checkNewPage(doc, y, 20, 220)

  doc.setDrawColor(200, 220, 200); doc.setLineWidth(0.3)
  doc.line(margin, y, W - margin, y)
  y += 6

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  doc.text('SIGNATURES', margin, y)
  y += 5

  doc.setFontSize(8)
  doc.text('By signing below, each Party confirms they have read, understood, and accepted all terms of this Agreement.', margin, y)
  y += 7

  const sigBoxH = 52
  const halfW   = (contentW / 2) - 4

  // ─── Lender box ───────────────────────────────────────────────────────
  doc.setFillColor(248, 252, 248)
  doc.rect(margin, y, halfW, sigBoxH, 'F')
  doc.setDrawColor(180, 210, 180); doc.rect(margin, y, halfW, sigBoxH)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
  doc.setTextColor(0, 100, 40); doc.text('LENDER', margin + 3, y + 6)
  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
  doc.text(`Name: ${companyName}`, margin + 3, y + 12)
  doc.text(`Authorised Rep: ${directorName}`, margin + 3, y + 17)
  doc.text(`Title: ${directorTitle}`, margin + 3, y + 22)

  // Stamp (top right of lender box)
  const stampCx = margin + halfW - 16
  const stampCy = y + 18
  if (stampDataUrl) {
    try { doc.addImage(stampDataUrl, 'PNG', stampCx - 14, y + 4, 28, 28) }
    catch { drawGeneratedStamp(doc, stampCx, stampCy, companyName, directorName, 14) }
  } else {
    drawGeneratedStamp(doc, stampCx, stampCy, companyName, directorName, 14)
  }

  // Signature image
  if (sigDataUrl) {
    try { doc.addImage(sigDataUrl, 'PNG', margin + 3, y + 26, 44, 14) }
    catch { drawGeneratedSignature(doc, margin + 3, y + 26, directorName, 44) }
  } else {
    drawGeneratedSignature(doc, margin + 3, y + 26, directorName, 44)
  }

  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal')
  doc.text('Date: ___________________________', margin + 3, y + sigBoxH - 4)

  // ─── Borrower box ─────────────────────────────────────────────────────
  const bx = margin + halfW + 8
  doc.setFillColor(248, 252, 248)
  doc.rect(bx, y, halfW, sigBoxH, 'F')
  doc.setDrawColor(180, 210, 180); doc.rect(bx, y, halfW, sigBoxH)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
  doc.setTextColor(0, 100, 40); doc.text('BORROWER', bx + 3, y + 6)
  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
  doc.text(`Name: ${clientName}`, bx + 3, y + 12)
  doc.text(`Phone: ${clientPhone}`, bx + 3, y + 17)
  doc.text('Electronic Signature / Acceptance:', bx + 3, y + 23)
  doc.line(bx + 3, y + 32, bx + halfW - 4, y + 32)
  doc.text('Date:', bx + 3, y + 38)
  doc.line(bx + 14, y + 38, bx + halfW - 4, y + 38)
  doc.text('Thumbprint Box:', bx + 3, y + sigBoxH - 4)
  doc.rect(bx + halfW - 22, y + sigBoxH - 14, 18, 10)

  y += sigBoxH + 6

  // ── Acceptance note ────────────────────────────────────────────────────
  doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(80, 80, 80)
  doc.text('By selecting "I Agree" or electronically signing this Agreement, the Borrower confirms they have read, understood, and accepted all terms herein.', margin, y, { maxWidth: contentW })
  doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0)

  // ── Footer on every page ───────────────────────────────────────────────
  const total = doc.internal.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFillColor(0, 80, 30); doc.rect(0, 287, W, 10, 'F')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(255, 255, 255)
    doc.text(`${companyName}  |  ${companyEmail}  |  ${companyAddr}`, W / 2, 293, { align: 'center' })
    doc.text(`Page ${i} of ${total}  |  Ref: ${loan.loan_ref}`, W - margin, 293, { align: 'right' })
    doc.setTextColor(0, 0, 0)
  }

  return doc
}

export function downloadAgreement(doc, loanRef) {
  doc.save(`FTILoan-Agreement-${loanRef}.pdf`)
}

export function getAgreementDataUrl(doc) {
  return doc.output('datauristring')
}
