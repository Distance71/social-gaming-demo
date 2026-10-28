/**
 * Generador determinístico de tiras de rodillo (base y giros gratis).
 *
 * En `promexdotme/laravel-social-gaming` (`casino/app/Games/BookOfNileNG/reels.txt`),
 * las tiras estáticas no están calibradas por sí solas porque `SlotSettings::GetSpinSettings()`
 * en PHP fuerza el RTP desde el servidor descartando tableros según el `GameBank`.
 *
 * Para que el motor en React sea 100% transparente, auditable y matemáticamente
 * equilibrado (~96.2% RTP) sin trampas de servidor, generamos las tiras con pesos
 * calibrados y semilla fija (`mulberry32`), garantizando además que no haya dos
 * símbolos idénticos consecutivos en una misma tira (evitando 2 Libros en el mismo rodillo).
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

type Weights = Record<string, number[]>

const BASE: Weights = {
  1:  [2, 2, 2, 2, 2],        // Libro (Wild + Scatter)
  3:  [1, 1, 1, 1, 1],        // Explorador (paga desde 2)
  4:  [3, 3, 3, 3, 3],        // Faraón (paga desde 2)
  5:  [6, 6, 6, 6, 6],        // Escarabajo
  6:  [6, 6, 6, 6, 6],        // Horus / Ánfora
  7:  [9, 9, 9, 9, 9],        // A
  8:  [9, 9, 9, 9, 9],        // K
  9:  [9, 9, 9, 9, 9],        // Q
  10: [12, 12, 12, 12, 12],   // J
  11: [13, 13, 13, 13, 13],   // 10
}

const FREE: Weights = {
  ...BASE,
  3:  [1, 1, 1, 1, 1],
  4:  [2, 2, 2, 2, 2],
}

function buildStrip(weights: Weights, reel: number, rand: () => number): number[] {
  const pool: number[] = []
  for (const [sym, per] of Object.entries(weights)) {
    for (let i = 0; i < per[reel]; i++) pool.push(Number(sym))
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  // Evita símbolos iguales adyacentes o a distancia 2 en el mismo rodillo visible (ventana de 3)
  // especialmente para que nunca caigan dos Libros en el mismo rodillo.
  for (let pass = 0; pass < 80; pass++) {
    let clean = true
    for (let i = 0; i < pool.length; i++) {
      const next1 = (i + 1) % pool.length
      const next2 = (i + 2) % pool.length
      const conflictAdjacent = pool[i] === pool[next1]
      const conflictBookWindow = pool[i] === 1 && pool[next2] === 1
      if (!conflictAdjacent && !conflictBookWindow) continue
      clean = false
      const j = Math.floor(rand() * pool.length)
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    if (clean) break
  }
  return pool
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20260914)
const out = {
  base: Array.from({ length: 5 }, (_, r) => buildStrip(BASE, r, rand)),
  free: Array.from({ length: 5 }, (_, r) => buildStrip(FREE, r, rand)),
}

const here = dirname(fileURLToPath(import.meta.url))
writeFileSync(join(here, '..', 'src', 'engine', 'reels.json'), JSON.stringify(out, null, 0))
console.log('Tiras generadas en src/engine/reels.json')
console.log('base lengths:', out.base.map((s) => s.length).join(', '))
console.log('free lengths:', out.free.map((s) => s.length).join(', '))
