import {
  ADD_FREE_SPINS, BASE_STRIPS, BOOK, BOOKS_TO_TRIGGER, EXPANDING_CANDIDATES,
  FREE_SPINS, FREE_STRIPS, LINES, PAYTABLE, REELS, ROWS, SCATTER_PAY,
  type SymbolId,
} from './config'

/** Grilla visible de 5×3: `grid[reel][row]`. */
export type Grid = SymbolId[][]

export type LineWin = {
  /** Índice de la línea (0..9). */
  line: number
  symbol: SymbolId
  count: number
  amount: number
  /** Celdas `[reel, row]` que forman la línea ganadora. */
  cells: [number, number][]
}

export type ExpandedWin = {
  symbol: SymbolId
  /** Rodillos (0..4) donde apareció el símbolo y que se expandieron a las 3 filas. */
  reels: number[]
  /** Cantidad de líneas activas en las que pagó la expansión. */
  linesCount: number
  amount: number
}

export type SpinResult = {
  grid: Grid
  /** Índice de parada en cada tira de rodillo (`0..strip.length-1`). */
  stops: number[]
  lineWins: LineWin[]
  bookCount: number
  bookCells: [number, number][]
  bookWin: number
  /** Presente únicamente en giros gratis cuando el símbolo especial alcanza el mínimo para expandirse y pagar. */
  expanded: ExpandedWin | null
  totalWin: number
  /** Giros gratis ganados en este tiro: 10 al disparar el bonus, 5 en retrigger. */
  freeSpinsAwarded: number
}

export type SpinOptions = {
  /** Apuesta por línea. */
  bet: number
  /** Cantidad de líneas activas (1..10, por defecto 10). */
  activeLines?: number
  /** Si es un giro dentro de la ronda de giros gratis. */
  free?: boolean
  /** Símbolo expandible sorteado al iniciar la ronda de giros gratis. */
  expandingSymbol?: SymbolId
  rng?: () => number
}

export type CardSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type GambleChoice = 'red' | 'black' | CardSuit

export type GambleCard = {
  suit: CardSuit
  color: 'red' | 'black'
  rank: string
}

export type GambleResult = {
  won: boolean
  multiplier: 2 | 4
  nextAmount: number
  card: GambleCard
}

const defaultRng = () => Math.random()

/** Sortea el símbolo expandible de la ronda, equivalente a `DoMysteryScatter` en `Server.php`. */
export function pickExpandingSymbol(rng = defaultRng): SymbolId {
  return EXPANDING_CANDIDATES[Math.floor(rng() * EXPANDING_CANDIDATES.length)]
}

/**
 * Elige una posición al azar en cada una de las 5 tiras y lee 3 símbolos consecutivos.
 */
export function spinReels(
  rng = defaultRng,
  strips = BASE_STRIPS,
): { grid: Grid; stops: number[] } {
  const grid: Grid = []
  const stops: number[] = []
  for (let r = 0; r < REELS; r++) {
    const strip = strips[r]
    const stop = Math.floor(rng() * strip.length)
    stops.push(stop)
    const column: SymbolId[] = []
    for (let row = 0; row < ROWS; row++) {
      column.push(strip[(stop + row) % strip.length])
    }
    grid.push(column)
  }
  return { grid, stops }
}

/** Construye la grilla a partir de posiciones exactas de parada `stops`. */
export function gridFromStops(stops: number[], strips = BASE_STRIPS): Grid {
  return stops.map((stop, r) => {
    const strip = strips[r]
    const s = ((stop % strip.length) + strip.length) % strip.length
    return Array.from({ length: ROWS }, (_, row) => strip[(s + row) % strip.length])
  })
}

/**
 * Evalúa una línea de 5 símbolos de izquierda a derecha (`WinChecker::getWin`).
 * - El Libro (`BOOK = 1`) sustituye a cualquier símbolo regular.
 * - Si la línea arranca con uno o más Libros, se compara el pago del prefijo puro de Libros
 *   contra el pago sustituyendo al primer símbolo no-Libro, quedándose con el mayor.
 */
function evalLine(line: SymbolId[]): { symbol: SymbolId; count: number; mult: number } {
  let bookPrefix = 0
  while (bookPrefix < REELS && line[bookPrefix] === BOOK) {
    bookPrefix++
  }

  if (bookPrefix === REELS) {
    const mult = PAYTABLE[BOOK][REELS] ?? 0
    return { symbol: BOOK, count: REELS, mult }
  }

  let subSymbol: SymbolId = line[0]
  let subCount = 1
  for (let reel = 1; reel < REELS; reel++) {
    const v = line[reel]
    if (v !== BOOK && subSymbol === BOOK) subSymbol = v
    if (subSymbol !== BOOK && subSymbol !== v && v !== BOOK) break
    subCount++
  }

  const subMult = PAYTABLE[subSymbol]?.[subCount] ?? 0
  const bookMult = bookPrefix > 0 ? (PAYTABLE[BOOK]?.[bookPrefix] ?? 0) : 0

  if (bookMult > subMult) {
    return { symbol: BOOK, count: bookPrefix, mult: bookMult }
  }
  return { symbol: subSymbol, count: subCount, mult: subMult }
}

/**
 * En la ronda de giros gratis, el símbolo especial se expande para cubrir las 3 filas
 * de cualquier rodillo donde aparezca, SIEMPRE QUE aparezca en suficientes rodillos
 * para formar premio (`PAYTABLE[symbol][reels.length] > 0`).
 * Paga en todas las líneas activas sin requerir que los rodillos sean adyacentes.
 */
function evaluateExpansion(
  grid: Grid,
  symbol: SymbolId,
  bet: number,
  activeLinesCount: number,
): ExpandedWin | null {
  const reels: number[] = []
  for (let r = 0; r < REELS; r++) {
    if (grid[r].includes(symbol)) reels.push(r)
  }
  const perLineMult = PAYTABLE[symbol]?.[reels.length] ?? 0
  if (perLineMult <= 0) return null

  const amount = perLineMult * bet * activeLinesCount
  return {
    symbol,
    reels,
    linesCount: activeLinesCount,
    amount,
  }
}

export function evaluate(grid: Grid, opts: SpinOptions): Omit<SpinResult, 'grid' | 'stops'> {
  const { bet, free = false, expandingSymbol } = opts
  const activeLinesCount = Math.min(Math.max(opts.activeLines ?? LINES.length, 1), LINES.length)

  const lineWins: LineWin[] = []
  for (let l = 0; l < activeLinesCount; l++) {
    const line = LINES[l].map((row, reel) => grid[reel][row])
    const { symbol, count, mult } = evalLine(line)
    const amount = mult * bet
    if (amount <= 0) continue
    lineWins.push({
      line: l,
      symbol,
      count,
      amount,
      cells: Array.from({ length: count }, (_, r) => [r, LINES[l][r]] as [number, number]),
    })
  }

  const bookCells: [number, number][] = []
  for (let r = 0; r < REELS; r++) {
    for (let row = 0; row < ROWS; row++) {
      if (grid[r][row] === BOOK) bookCells.push([r, row])
    }
  }
  const bookCount = bookCells.length
  // El scatter del Libro paga sobre la apuesta total (apuesta por línea × líneas activas).
  const bookWin = (SCATTER_PAY[bookCount] ?? 0) * bet * activeLinesCount

  const expanded =
    free && expandingSymbol
      ? evaluateExpansion(grid, expandingSymbol, bet, activeLinesCount)
      : null

  const totalWin =
    lineWins.reduce((acc, w) => acc + w.amount, 0) + bookWin + (expanded?.amount ?? 0)

  return {
    lineWins,
    bookCount,
    bookCells,
    bookWin,
    expanded,
    totalWin,
    freeSpinsAwarded:
      bookCount >= BOOKS_TO_TRIGGER ? (free ? ADD_FREE_SPINS : FREE_SPINS) : 0,
  }
}

export function spin(opts: SpinOptions): SpinResult {
  const rng = opts.rng ?? defaultRng
  const strips = opts.free ? FREE_STRIPS : BASE_STRIPS
  const { grid, stops } = spinReels(rng, strips)
  return { grid, stops, ...evaluate(grid, opts) }
}

/**
 * Busca en las tiras reales una combinación que cumpla un escenario de demostración
 * (`free_spins` = 3+ Libros, `big_win` = 4 o 5 Exploradores/Faraones, `win` = premio de línea).
 */
export function forcePresetSpin(
  preset: 'free_spins' | 'big_win' | 'win',
  opts: SpinOptions,
): SpinResult {
  const rng = opts.rng ?? defaultRng
  const strips = opts.free ? FREE_STRIPS : BASE_STRIPS

  if (preset === 'free_spins') {
    // Encuentra una posición con Libro en al menos 3 rodillos distintos
    const chosenReels = [0, 1, 2, 3, 4].sort(() => rng() - 0.5).slice(0, 3)
    const stops = strips.map((strip, r) => {
      if (chosenReels.includes(r)) {
        const idx = strip.indexOf(BOOK)
        if (idx !== -1) {
          const rowOffset = Math.floor(rng() * ROWS)
          return (idx - rowOffset + strip.length) % strip.length
        }
      }
      // Rodillo sin libro
      for (let attempt = 0; attempt < 40; attempt++) {
        const s = Math.floor(rng() * strip.length)
        const col = [strip[s], strip[(s + 1) % strip.length], strip[(s + 2) % strip.length]]
        if (!col.includes(BOOK)) return s
      }
      return 0
    })
    const grid = gridFromStops(stops, strips)
    return { grid, stops, ...evaluate(grid, opts) }
  }

  if (preset === 'big_win') {
    // Alinea el símbolo 3 (Explorador) en la línea central (fila 1) en los 5 rodillos
    const stops = strips.map((strip) => {
      const idx = strip.indexOf(3)
      return idx !== -1 ? (idx - 1 + strip.length) % strip.length : 0
    })
    const grid = gridFromStops(stops, strips)
    return { grid, stops, ...evaluate(grid, opts) }
  }

  // 'win': busca un giro ganador moderado para probar cobro o Gamble
  for (let i = 0; i < 300; i++) {
    const res = spin({ ...opts, rng })
    if (res.totalWin >= opts.bet * 15 && res.freeSpinsAwarded === 0) {
      return res
    }
  }
  return spin({ ...opts, rng })
}

const RANKS = ['A', 'K', 'Q', 'J', '10', '9']
const SUITS: CardSuit[] = ['hearts', 'diamonds', 'clubs', 'spades']

/**
 * Resuelve un intento de Doblar (`GambleRequest` en `Server.php`).
 * - Elección `'red' | 'black'`: probabilidad 50%, multiplica ×2.
 * - Elección de palo (`'hearts' | 'diamonds' | 'clubs' | 'spades'`): probabilidad 25%, multiplica ×4.
 */
export function resolveGamble(
  currentAmount: number,
  choice: GambleChoice,
  rng = defaultRng,
): GambleResult {
  const suit = SUITS[Math.floor(rng() * SUITS.length)]
  const rank = RANKS[Math.floor(rng() * RANKS.length)]
  const color: 'red' | 'black' = suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black'
  const card: GambleCard = { suit, color, rank }

  const isColorChoice = choice === 'red' || choice === 'black'
  const multiplier: 2 | 4 = isColorChoice ? 2 : 4
  const won = isColorChoice ? choice === color : choice === suit

  return {
    won,
    multiplier,
    nextAmount: won ? currentAmount * multiplier : 0,
    card,
  }
}
