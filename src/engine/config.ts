import reels from './reels.json'

/**
 * Identificadores tomados de `casino/app/Games/BookOfNileNG/` (`promexdotme/laravel-social-gaming`):
 * - `1` es el Libro Sagrado (actúa como Wild comodín en líneas y como Scatter en cualquier posición).
 * - `3..11` son los 9 símbolos regulares pagadores (de mayor a menor valor).
 */
export const BOOK = 1

export type SymbolId = 1 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11

export const SYMBOLS: SymbolId[] = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11]

/**
 * Tabla de pagos por línea en múltiplos de la apuesta por línea (`bet`).
 * El índice representa la cantidad de símbolos consecutivos desde el rodillo 1 (0..5).
 * Cuando una línea está compuesta exclusivamente por Libros (`1`), paga igual que el
 * símbolo máximo (`3` Explorador).
 */
export const PAYTABLE: Record<SymbolId, number[]> = {
  1:  [0, 0, 10, 100, 900, 3500], // línea pura de Libros (Wild top)
  3:  [0, 0, 10, 100, 900, 3500], // Explorador (paga desde 2)
  4:  [0, 0,  5,  40, 320, 1400], // Faraón (paga desde 2)
  5:  [0, 0,  0,  28, 115,  650], // Escarabajo (paga desde 3)
  6:  [0, 0,  0,  28, 115,  650], // Horus / Halcón (paga desde 3)
  7:  [0, 0,  0,   8,  40,  165], // A
  8:  [0, 0,  0,   8,  40,  165], // K
  9:  [0, 0,  0,   8,  40,  165], // Q
  10: [0, 0,  0,   5,  25,  110], // J
  11: [0, 0,  0,   5,  25,  110], // 10
}

/** Pago Scatter del Libro según cantidad total en el tablero (múltiplo de la apuesta TOTAL). */
export const SCATTER_PAY = [0, 0, 0, 2, 20, 200]

/**
 * Las 10 líneas de pago clásicas de `BookOfNileNG` / `BookOfRa` (`Server.php`).
 * Cada línea es un array de 5 filas (0 = arriba, 1 = centro, 2 = abajo), una por rodillo.
 */
export const LINES: number[][] = [
  [1, 1, 1, 1, 1], // Línea 1: centro
  [0, 0, 0, 0, 0], // Línea 2: arriba
  [2, 2, 2, 2, 2], // Línea 3: abajo
  [0, 1, 2, 1, 0], // Línea 4: V
  [2, 1, 0, 1, 2], // Línea 5: V invertida
  [1, 0, 0, 0, 1], // Línea 6: puente superior
  [1, 2, 2, 2, 1], // Línea 7: puente inferior
  [0, 0, 1, 2, 2], // Línea 8: escalón descendente
  [2, 2, 1, 0, 0], // Línea 9: escalón ascendente
  [1, 2, 1, 0, 1], // Línea 10: zigzag
]

/** Colores distintivos para renderizar cada una de las 10 líneas de pago en el overlay SVG. */
export const LINE_COLORS: string[] = [
  '#f5c542', // 1
  '#ef4444', // 2
  '#3b82f6', // 3
  '#10b981', // 4
  '#ec4899', // 5
  '#f97316', // 6
  '#06b6d4', // 7
  '#a855f7', // 8
  '#84cc16', // 9
  '#eab308', // 10
]

export const LINE_OPTIONS = [1, 3, 5, 7, 10] as const

export const REELS = 5
export const ROWS = 3

/** Libros necesarios en cualquier posición para disparar la ronda de giros gratis (`settings_needfs`). */
export const BOOKS_TO_TRIGGER = 3
/** Giros gratis iniciales al conseguir 3+ Libros (`fsmax` en `DoMysteryScatter`). */
export const FREE_SPINS = 10
/** Giros adicionales al conseguir 3+ Libros dentro del bonus (`settings_addfs`). */
export const ADD_FREE_SPINS = 5

/** Candidatos elegibles como Símbolo Expandible Especial durante los Giros Gratis. */
export const EXPANDING_CANDIDATES: SymbolId[] = [3, 4, 5, 6, 7, 8, 9, 10, 11]

/** Cantidad mínima de rodillos que necesita un símbolo para pagar al expandirse (2 para altos, 3 para bajos). */
export function minReelsToPay(symbol: SymbolId): number {
  const row = PAYTABLE[symbol]
  for (let c = 1; c <= REELS; c++) {
    if ((row?.[c] ?? 0) > 0) return c
  }
  return 3
}

/** Tiras del juego base y de giros gratis. */
export const BASE_STRIPS = reels.base as SymbolId[][]
export const FREE_STRIPS = reels.free as SymbolId[][]
