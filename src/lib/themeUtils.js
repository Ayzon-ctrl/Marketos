export const sidebarThemes = [
  { id: 'navy', label: 'Navy', sidebar: '#0f172a', sidebarMuted: '#cbd5e1', sidebarPanel: 'rgba(255,255,255,.08)', brand: '#1d4ed8' },
  { id: 'forest', label: 'Forest', sidebar: '#17301f', sidebarMuted: '#d4e7d7', sidebarPanel: 'rgba(255,255,255,.08)', brand: '#15803d' },
  { id: 'berry', label: 'Berry', sidebar: '#35172f', sidebarMuted: '#f2d9ea', sidebarPanel: 'rgba(255,255,255,.08)', brand: '#be185d' },
  { id: 'slate', label: 'Slate', sidebar: '#1f2937', sidebarMuted: '#dbe4ee', sidebarPanel: 'rgba(255,255,255,.08)', brand: '#475569' },
  { id: 'sand', label: 'Sand', sidebar: '#3a2f25', sidebarMuted: '#f3e8d7', sidebarPanel: 'rgba(255,255,255,.08)', brand: '#b45309' }
]

export const backgroundThemes = [
  { id: 'soft', label: 'Soft', background: '#f1f5f9', surface: '#ffffff' },
  { id: 'mist', label: 'Mist', background: '#eef2ff', surface: '#ffffff' },
  { id: 'sage', label: 'Sage', background: '#eef7f0', surface: '#ffffff' },
  { id: 'rose', label: 'Rose', background: '#fff5f7', surface: '#ffffff' },
  { id: 'stone', label: 'Stone', background: '#f5f5f4', surface: '#ffffff' }
]

const STORAGE_KEY = 'marketos-theme-v1'

export function getDefaultThemePrefs() {
  return {
    sidebarTheme: 'navy',
    backgroundTheme: 'soft'
  }
}

export function loadThemePrefs() {
  if (typeof window === 'undefined') return getDefaultThemePrefs()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return getDefaultThemePrefs()
    return { ...getDefaultThemePrefs(), ...JSON.parse(raw) }
  } catch {
    return getDefaultThemePrefs()
  }
}

export function saveThemePrefs(nextPrefs) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPrefs))
}

export function buildThemeStyle(themePrefs) {
  const sidebarTheme = sidebarThemes.find(item => item.id === themePrefs.sidebarTheme) || sidebarThemes[0]
  const backgroundTheme = backgroundThemes.find(item => item.id === themePrefs.backgroundTheme) || backgroundThemes[0]

  return {
    '--sidebar-bg': sidebarTheme.sidebar,
    '--sidebar-muted': sidebarTheme.sidebarMuted,
    '--sidebar-panel': sidebarTheme.sidebarPanel,
    '--brand-accent': sidebarTheme.brand,
    '--page-bg': backgroundTheme.background,
    '--surface-bg': backgroundTheme.surface
  }
}
