import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatNaira(amount) {
  return '₦' + Number(amount || 0).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatDate(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export function formatDateTime(date) {
  if (!date) return '—'
  return new Date(date).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function loanStatusColor(status) {
  const map = {
    pending:        'amber',
    under_review:   'blue',
    agent_approved: 'amber',
    manager_review: 'blue',
    admin_approved: 'green',
    rejected:       'red',
    disbursed:      'blue',
    active:         'green',
    completed:      'green',
    defaulted:      'red',
  }
  return map[status] || 'gray'
}

export function loanStatusLabel(status) {
  const map = {
    pending:        'Pending',
    under_review:   'Under Review',
    agent_approved: 'Awaiting Admin',
    manager_review: 'With Manager',
    admin_approved: 'Approved',
    rejected:       'Rejected',
    disbursed:      'Disbursed',
    active:         'Active',
    completed:      'Completed',
    defaulted:      'Defaulted',
  }
  return map[status] || status?.replace(/_/g, ' ')
}

export function calcLoan(principal, durationMonths, rate = 7, adminPct = 1) {
  const totalRate    = rate * durationMonths
  const interest     = Math.round(principal * totalRate / 100 * 100) / 100
  const totalRepay   = principal + interest
  const adminCharge  = Math.round(principal * adminPct / 100 * 100) / 100
  const disbursed    = principal - adminCharge
  return { principal, interest, totalRepay, adminCharge, disbursed, totalRate, rate }
}
