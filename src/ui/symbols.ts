import { BOOK, type SymbolId } from '../engine/config'

export type SymbolMeta = {
  glyph: string
  color: string
  bg: string
  label: string
  tier: 'special' | 'high' | 'medium' | 'low'
}

export const SYMBOL_ART: Record<SymbolId, SymbolMeta> = {
  [BOOK]: {
    glyph: '📖',
    color: '#fbbf24',
    bg: 'radial-gradient(circle at 50% 35%, rgba(251, 191, 36, 0.28), rgba(120, 53, 15, 0.18))',
    label: 'Libro Sagrado',
    tier: 'special',
  },
  3: {
    glyph: '🧭',
    color: '#f59e0b',
    bg: 'radial-gradient(circle at 50% 35%, rgba(245, 158, 11, 0.22), rgba(20, 16, 10, 0.4))',
    label: 'Explorador',
    tier: 'high',
  },
  4: {
    glyph: '👑',
    color: '#eab308',
    bg: 'radial-gradient(circle at 50% 35%, rgba(234, 179, 8, 0.2), rgba(20, 16, 10, 0.4))',
    label: 'Faraón',
    tier: 'high',
  },
  5: {
    glyph: '🪲',
    color: '#2dd4bf',
    bg: 'radial-gradient(circle at 50% 35%, rgba(45, 212, 191, 0.18), rgba(20, 16, 10, 0.4))',
    label: 'Escarabajo',
    tier: 'medium',
  },
  6: {
    glyph: '🦅',
    color: '#fb923c',
    bg: 'radial-gradient(circle at 50% 35%, rgba(251, 146, 60, 0.18), rgba(20, 16, 10, 0.4))',
    label: 'Horus',
    tier: 'medium',
  },
  7: {
    glyph: 'A',
    color: '#f87171',
    bg: 'none',
    label: 'As (A)',
    tier: 'low',
  },
  8: {
    glyph: 'K',
    color: '#60a5fa',
    bg: 'none',
    label: 'Rey (K)',
    tier: 'low',
  },
  9: {
    glyph: 'Q',
    color: '#c084fc',
    bg: 'none',
    label: 'Reina (Q)',
    tier: 'low',
  },
  10: {
    glyph: 'J',
    color: '#4ade80',
    bg: 'none',
    label: 'Jota (J)',
    tier: 'low',
  },
  11: {
    glyph: '10',
    color: '#94a3b8',
    bg: 'none',
    label: 'Diez (10)',
    tier: 'low',
  },
}
