export type MobileViewMode = 'off' | 'pocket-2d' | 'touch-3d'

/**
 * Returns true if the current browser is a Meta Quest / standalone WebXR headset
 * so we never accidentally default a VR headset into 2D mobile phone mode.
 */
export function isXRHeadsetBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /OculusBrowser|Quest|Wolvic|PICO|Viveport|VisionOS/i.test(ua)
}

/**
 * Returns true if the user navigated via `/mobile`, `?mobile=1`, `?mode=mobile`, or `#mobile`.
 */
export function hasExplicitMobileUrlFlag(): boolean {
  if (typeof window === 'undefined') return false
  const { pathname, search, hash } = window.location
  if (/\/mobile\/?$/i.test(pathname)) return true
  if (hash && /mobile/i.test(hash)) return true
  const params = new URLSearchParams(search)
  return (
    params.get('mobile') === '1' ||
    params.get('mobile') === 'true' ||
    params.get('mode') === 'mobile'
  )
}

/**
 * Returns true if the device is a phone/compact touch viewport or opened the `/mobile` link.
 */
export function detectInitialMobileViewMode(): MobileViewMode {
  if (typeof window === 'undefined') return 'off'
  if (isXRHeadsetBrowser()) return 'off'

  const params = new URLSearchParams(window.location.search)
  if (params.get('mode') === '3d' || params.get('mobile') === '3d') {
    return 'touch-3d'
  }
  if (hasExplicitMobileUrlFlag()) {
    return 'pocket-2d'
  }

  const isCompactTouch =
    window.innerWidth <= 820 &&
    (navigator.maxTouchPoints > 0 || 'ontouchstart' in window)
  if (isCompactTouch) {
    return 'pocket-2d'
  }

  return 'off'
}

/**
 * Builds a shareable Mobile Companion URL (`?mobile=1`) that works on both
 * GitHub Pages (`/vr-lounge/?mobile=1`) and local dev servers.
 */
export function getShareableMobileUrl(): string {
  if (typeof window === 'undefined') return '?mobile=1'
  const url = new URL(window.location.href)
  url.pathname = url.pathname.replace(/\/mobile\/?$/i, '/')
  url.searchParams.set('mobile', '1')
  url.hash = ''
  return url.toString()
}

/**
 * Compresses and resizes a user-selected camera roll / photo library image file
 * into a compact JPEG data URL (`<= 512px`, quality `0.72`, ~25-45 KB) suitable
 * for real-time room customization broadcast and `THREE.TextureLoader` wall frames.
 */
export function compressImageFileToDataUrl(
  file: File,
  maxDimension = 512,
  quality = 0.72,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read selected image file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Invalid image format.'))
      img.onload = () => {
        const scale = Math.min(
          1,
          maxDimension / Math.max(1, img.width),
          maxDimension / Math.max(1, img.height),
        )
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable.'))
          return
        }
        ctx.fillStyle = '#0B0E14'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}
