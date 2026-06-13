// Simple storage — localStorage works fine in Capacitor WebView
// The previous issue was the init() timing, not storage itself

const SESSION_KEY = 'ftiloan_user'

export function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch(e) {}
}

export function storageGet(key) {
  try {
    const val = localStorage.getItem(key)
    return val ? JSON.parse(val) : null
  } catch(e) { return null }
}

export function storageRemove(key) {
  try {
    localStorage.removeItem(key)
  } catch(e) {}
}
