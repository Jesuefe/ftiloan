// Detect if running inside Capacitor native app
export const isNative = () => {
  return window.Capacitor !== undefined && window.Capacitor.isNativePlatform()
}

export const isAndroid = () => {
  return isNative() && window.Capacitor.getPlatform() === 'android'
}

// Returns true if we should use mobile layout
export const isMobile = () => {
  return isNative() || window.innerWidth < 1024
}
