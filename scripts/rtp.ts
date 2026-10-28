/**
 * Simulador Monte Carlo de RTP (Return To Player).
 *
 *   npm run rtp
 *   npm run rtp -- 2000000
 */
import { pickExpandingSymbol, spin } from '../src/engine/engine'
import { LINES, type SymbolId } from '../src/engine/config'

const spins = Number(process.argv[2] ?? 1_000_000)
const bet = 1
const cost = bet * LINES.length

let wagered = 0
let hits = 0
let biggestWin = 0
let freeSpinsLeft = 0
let expanding: SymbolId = 3
let rounds = 0
let retriggers = 0
const from = { lines: 0, book: 0, expanded: 0 }

for (let i = 0; i < spins; i++) {
  const free = freeSpinsLeft > 0
  if (free) freeSpinsLeft--
  else wagered += cost

  const r = spin({ bet, free, expandingSymbol: free ? expanding : undefined })

  from.lines += r.lineWins.reduce((a, w) => a + w.amount, 0)
  from.book += r.bookWin
  from.expanded += r.expanded?.amount ?? 0
  if (r.totalWin > 0) hits++
  if (r.totalWin > biggestWin) biggestWin = r.totalWin

  if (r.freeSpinsAwarded > 0) {
    if (!free) {
      expanding = pickExpandingSymbol()
      rounds++
    } else {
      retriggers++
    }
    freeSpinsLeft += r.freeSpinsAwarded
  }
}

const returned = from.lines + from.book + from.expanded
const pct = (n: number) => `${((n / wagered) * 100).toFixed(2)} %`
console.log(`giros simulados:      ${spins.toLocaleString('es-AR')}`)
console.log(`total apostado:       ${wagered.toLocaleString('es-AR')}`)
console.log(`RTP total:            ${pct(returned)}`)
console.log(`  ├─ de líneas:       ${pct(from.lines)}`)
console.log(`  ├─ del libro:       ${pct(from.book)}`)
console.log(`  └─ de expansión:    ${pct(from.expanded)}`)
console.log(`frecuencia de acierto:${((hits / spins) * 100).toFixed(2)} %`)
console.log(`rondas de bonus:      1 cada ${Math.round(spins / Math.max(rounds, 1))} giros`)
console.log(`retriggers:           ${((retriggers / Math.max(rounds, 1)) * 100).toFixed(1)} % de las rondas`)
console.log(`premio máximo:        ${Math.round(biggestWin).toLocaleString('es-AR')} (${(biggestWin / cost).toFixed(0)}x la apuesta)`)
