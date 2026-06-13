// Native-safe storage — uses Capacitor Preferences on device, localStorage on web
let Preferences = null

async function getPreferences() {
  if (Preferences) return Preferences
  try {
    if (window.Capacitor?.isNativePlatform()) {
      const mod = await import('@capacitor/preferences')
      Preferences = mod.Preferences
    }
  } catch(e) {}
  return Preferences
}

export async function storageSet(key, value) {
  try {
    const prefs = await getPreferences()
    if (prefs) {
      await prefs.set({ key, value: JSON.stringify(value) })
    } else {
      localStorage.setItem(key, JSON.stringify(value))
    }
  } catch(e) {
    localStorage.setItem(key, JSON.stringify(value))
  }
}

export async function storageGet(key) {
  try {
    const prefs = await getPreferences()
    if (prefs) {
      const { value } = await prefs.get({ key })
      return value ? JSON.parse(value) : null
    } else {
      const val = localStorage.getItem(key)
      return val ? JSON.parse(val) : null
    }
  } catch(e) {
    try {
      const val = localStorage.getItem(key)
      return val ? JSON.parse(val) : null
    } catch { return null }
  }
}

export async function storageRemove(key) {
  try {
    const prefs = await getPreferences()
    if (prefs) {
      await prefs.remove({ key })
    } else {
      localStorage.removeItem(key)
    }
  } catch(e) {
    localStorage.removeItem(key)
  }
}
