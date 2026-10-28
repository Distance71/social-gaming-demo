import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { evaluate, forcePresetSpin, resolveGamble, spinReels, type Grid } from './engine'
import {
  ADD_FREE_SPINS, BOOK, FREE_SPINS, LINES, PAYTABLE, REELS, ROWS, SCATTER_PAY,
  type SymbolId,
} from './config'

function board(overrides: Record<string, SymbolId> = {}): Grid {
  const grid: Grid = Array.from({ length: REELS }, (_, r) =>
    Array.from({ length: ROWS }, () => (r === 0 ? 7 : 10) as SymbolId),
  )
  for (const [key, sym] of Object.entries(overrides)) {
    const [r, row] = key.split(',').map(Number)
    grid[r][row] = sym
  }
  return grid
}

const middle = (syms: SymbolId[]) =>
  board(Object.fromEntries(syms.map((s, r) => [`${r},1`, s])))

const opts = { bet: 1 }

test('el tablero base de control no paga nada', () => {
  assert.equal(evaluate(board(), opts).totalWin, 0)
})

test('3 símbolos iguales desde el rodillo 1 pagan según PAYTABLE y marcan sus celdas', () => {
  const r = evaluate(middle([5, 5, 5, 7, 10]), opts)
  assert.equal(r.totalWin, PAYTABLE[5][3])
  assert.equal(r.lineWins[0].line, 0)
  assert.deepEqual(r.lineWins[0].cells, [[0, 1], [1, 1], [2, 1]])
})

test('símbolos altos (3 y 4) pagan desde 2 apariciones', () => {
  const r = evaluate(middle([3, 3, 7, 10, 10]), opts)
  assert.equal(r.totalWin, PAYTABLE[3][2])
})

test('la combinación debe comenzar en el rodillo 1', () => {
  assert.equal(evaluate(middle([7, 5, 5, 5, 10]), opts).lineWins.length, 0)
})

test('el libro sustituye como comodín dentro de una línea', () => {
  const con = evaluate(middle([5, BOOK, 5, 7, 10]), opts).totalWin
  assert.equal(con, PAYTABLE[5][3])
})

test('si la línea empieza con libro, elige el pago mayor entre prefijo de libros o sustitución', () => {
  // [BOOK, 5, 5, 7, 10] -> 1 Libro no paga solo, pero comotres 5s paga PAYTABLE[5][3] = 28
  const r1 = evaluate(middle([BOOK, 5, 5, 7, 10]), opts)
  assert.equal(r1.lineWins[0].symbol, 5)
  assert.equal(r1.lineWins[0].count, 3)

  // [BOOK, BOOK, BOOK, 10, 7] -> 3 Libros puros pagan 100, mientras que cuatro 10s pagarían 25
  const r2 = evaluate(middle([BOOK, BOOK, BOOK, 10, 7]), opts)
  assert.equal(r2.lineWins[0].symbol, BOOK)
  assert.equal(r2.lineWins[0].count, 3)
  assert.equal(r2.lineWins[0].amount, PAYTABLE[BOOK][3])
})

test('5 libros en una línea pagan el premio máximo (3500x apuesta por línea)', () => {
  const r = evaluate(middle([BOOK, BOOK, BOOK, BOOK, BOOK]), opts)
  assert.equal(r.lineWins[0].amount, PAYTABLE[BOOK][5])
})

test('3 libros en cualquier posición pagan scatter sobre la apuesta total y abren 10 giros gratis', () => {
  const r = evaluate(board({ '0,0': BOOK, '2,2': BOOK, '4,1': BOOK }), opts)
  assert.equal(r.bookCount, 3)
  assert.equal(r.bookWin, SCATTER_PAY[3] * opts.bet * LINES.length)
  assert.equal(r.freeSpinsAwarded, FREE_SPINS)
})

test('dentro de giros gratis, 3 libros suman 5 giros adicionales (retrigger)', () => {
  const grid = board({ '0,0': BOOK, '2,2': BOOK, '4,1': BOOK })
  const r = evaluate(grid, { bet: 1, free: true, expandingSymbol: 5 })
  assert.equal(r.freeSpinsAwarded, ADD_FREE_SPINS)
})

test('el símbolo expandible se expande y paga aunque los rodillos no sean adyacentes', () => {
  const grid = board({ '0,0': 5, '2,1': 5, '4,2': 5 })
  const r = evaluate(grid, { bet: 1, free: true, expandingSymbol: 5 })
  assert.deepEqual(r.expanded?.reels, [0, 2, 4])
  assert.equal(r.expanded?.amount, PAYTABLE[5][3] * LINES.length)
})

test('el símbolo expandible NO se expande si no alcanza la cantidad mínima de rodillos para pagar', () => {
  // Símbolo 5 necesita 3 rodillos; con 2 rodillos no debe devolver expansión
  const gridLow = board({ '0,0': 5, '2,1': 5 })
  assert.equal(evaluate(gridLow, { bet: 1, free: true, expandingSymbol: 5 }).expanded, null)

  // Símbolo 3 (Explorador) paga desde 2 rodillos; con 1 rodillo no expande, con 2 sí
  const gridHigh1 = board({ '0,0': 3 })
  assert.equal(evaluate(gridHigh1, { bet: 1, free: true, expandingSymbol: 3 }).expanded, null)

  const gridHigh2 = board({ '0,0': 3, '4,2': 3 })
  const rHigh2 = evaluate(gridHigh2, { bet: 1, free: true, expandingSymbol: 3 })
  assert.deepEqual(rHigh2.expanded?.reels, [0, 4])
  assert.equal(rHigh2.expanded?.amount, PAYTABLE[3][2] * LINES.length)
})

test('respeta la cantidad de líneas activas configurada', () => {
  const grid = board({ '0,0': 5, '1,0': 5, '2,0': 5 }) // Línea 2 (índice 1: fila 0)
  assert.equal(evaluate(grid, { bet: 1, activeLines: 1 }).lineWins.length, 0)
  assert.equal(evaluate(grid, { bet: 1, activeLines: 3 }).lineWins.length, 1)
})

test('resolveGamble duplica con color acertado y cuadruplica con palo acertado', () => {
  // rng = () => 0 elige suit='hearts' (red)
  const winRed = resolveGamble(100, 'red', () => 0)
  assert.equal(winRed.won, true)
  assert.equal(winRed.nextAmount, 200)

  const loseBlack = resolveGamble(100, 'black', () => 0)
  assert.equal(loseBlack.won, false)
  assert.equal(loseBlack.nextAmount, 0)

  const winHearts = resolveGamble(100, 'hearts', () => 0)
  assert.equal(winHearts.won, true)
  assert.equal(winHearts.nextAmount, 400)
})

test('forcePresetSpin genera jugadas reales sobre las tiras', () => {
  const fs = forcePresetSpin('free_spins', { bet: 1 })
  assert.ok(fs.bookCount >= 3)
  assert.equal(fs.freeSpinsAwarded, FREE_SPINS)

  const bw = forcePresetSpin('big_win', { bet: 1 })
  assert.ok(bw.totalWin >= PAYTABLE[3][5])
})

test('spinReels devuelve una ventana válida de 5×3', () => {
  const { grid, stops } = spinReels(() => 0)
  assert.deepEqual(stops, [0, 0, 0, 0, 0])
  assert.equal(grid.length, REELS)
  assert.equal(grid[0].length, ROWS)
})

test('CedarSlotService + MultiRowSlotEngine + CedarMath generan y verifican pruebas cedar-slot-v1 compatibles con cedar-client.js', async () => {
  const {
    CEDARCULES_MATH,
    CEDAR_MATH_VERSION,
    evaluateLines,
    generateWeightedGrid,
    sha256Hex,
    verifyCedarSlotProof,
  } = await import('./cedarSlotServer')

  const serverSeed = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90'
  const clientSeed = 'cedarcules_test_seed'
  const nonce = 1
  const serverSeedHash = await sha256Hex(serverSeed)

  const grid = await generateWeightedGrid(
    CEDARCULES_MATH.reel_weights,
    CEDARCULES_MATH.rows,
    serverSeed,
    clientSeed,
    nonce,
  )
  assert.equal(grid.length, 15)

  const evaluation = evaluateLines(
    grid,
    CEDARCULES_MATH.rows,
    CEDARCULES_MATH.paylines,
    CEDARCULES_MATH.paytable,
    CEDARCULES_MATH.wild,
    2.0 / CEDARCULES_MATH.paylines.length,
  )

  const proof = {
    bet_id: 'test-round-1',
    game: 'Cedarcules',
    math_version: CEDAR_MATH_VERSION,
    server_seed: serverSeed,
    server_seed_hash: serverSeedHash,
    client_seed: clientSeed,
    nonce,
    parameters: CEDARCULES_MATH,
    wager: 2.0,
    win: Number(evaluation.TotalWin),
    outcome: {
      grid,
      total_win: evaluation.TotalWin,
      line_wins: evaluation.WinLines,
    },
  }

  const verification = await verifyCedarSlotProof(proof)
  assert.equal(verification.valid, true)
  assert.deepEqual(verification.generatedGrid, grid)
})

test('MultiRowSlotEngine evaluateLines calcula pagos y sustitución Wild según MultiRowSlotEngine.php', async () => {
  const { CEDARCULES_MATH, evaluateLines } = await import('./cedarSlotServer')
  // Fila central (payline 0 = [1, 1, 1, 1, 1]) con [1 (wild), 2 (hero), 2 (hero), 2 (hero), 10 (shield)] -> 4x Hero (80x betPerLine)
  const grid = [
    '10', '9', '8', '7', '6',
    '1',  '2', '2', '2', '10',
    '6',  '7', '8', '9', '10',
  ]
  const res = evaluateLines(
    grid,
    CEDARCULES_MATH.rows,
    [CEDARCULES_MATH.paylines[0]],
    CEDARCULES_MATH.paytable,
    CEDARCULES_MATH.wild,
    1.0,
  )
  assert.equal(res.WinLines.length, 1)
  assert.equal(res.WinLines[0].WinSymbol, 2)
  assert.equal(res.WinLines[0].CountSymbols, 4)
  assert.equal(res.WinLines[0].Pay, '80.00')
  assert.deepEqual(res.WinLines[0].Positions, [5, 6, 7, 8])
})

