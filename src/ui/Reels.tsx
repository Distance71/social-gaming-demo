import { useEffect, useMemo, useRef, useState } from 'react'
import { BASE_STRIPS, BOOK, LINES, LINE_COLORS, REELS, ROWS, type SymbolId } from '../engine/config'
import type { SpinResult } from '../engine/engine'
import { SYMBOL_ART } from './symbols'

const BLUR_COUNT = 10

type Props = {
  result: SpinResult | null
  spinning: boolean
  expanded: boolean
  spinMs: number
  reelDelayMs: number
  highlighted: Set<string>
  activeLines: number
  hoveredLine: number | null
  onHoverLine: (line: number | null) => void
}

function randomSymbols(reel: number, n: number): SymbolId[] {
  const strip = BASE_STRIPS[reel]
  return Array.from({ length: n }, () => strip[Math.floor(Math.random() * strip.length)])
}

function Reel({
  reel,
  symbols,
  spinning,
  spinMs,
  delay,
  highlighted,
  dim,
  expanding,
}: {
  reel: number
  symbols: SymbolId[]
  spinning: boolean
  spinMs: number
  delay: number
  highlighted: Set<string>
  dim: boolean
  expanding: boolean
}) {
  const filler = useMemo(() => randomSymbols(reel, BLUR_COUNT), [reel, symbols])
  const strip = [...filler, ...symbols]
  const [offset, setOffset] = useState(BLUR_COUNT)
  const [animate, setAnimate] = useState(false)
  const raf = useRef<number>()

  useEffect(() => {
    if (!spinning) return
    setAnimate(false)
    setOffset(0)
    raf.current = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimate(true)
        setOffset(BLUR_COUNT)
      })
    })
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [spinning, symbols])

  return (
    <div className={`reel${expanding ? ' reel-expanded' : ''}`}>
      <div
        className="reel-strip"
        style={{
          transform: `translateY(calc(var(--cell) * ${-offset}))`,
          transition: animate
            ? `transform ${spinMs + delay}ms cubic-bezier(.16,.84,.34,1.03) ${delay}ms`
            : 'none',
        }}
      >
        {strip.map((sym, i) => {
          const row = i - BLUR_COUNT
          const win = highlighted.has(`${reel},${row}`)
          const art = SYMBOL_ART[sym]
          const isBook = sym === BOOK
          return (
            <div
              key={i}
              className={`cell${win ? ' cell-win' : ''}${isBook && row >= 0 ? ' cell-book' : ''}${
                dim && !win && row >= 0 ? ' cell-dim' : ''
              }`}
              style={{ color: art.color, backgroundImage: art.bg }}
            >
              <span className={`glyph glyph-${art.tier}`}>{art.glyph}</span>
              <span className="cell-label">{art.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function Reels({
  result,
  spinning,
  expanded,
  spinMs,
  reelDelayMs,
  highlighted,
  activeLines,
  hoveredLine,
  onHoverLine,
}: Props) {
  const base = result?.grid ?? BASE_STRIPS.map((s) => s.slice(0, ROWS))
  const expandedReels = expanded ? result?.expanded?.reels ?? [] : []

  const grid = base.map((col, r) =>
    expandedReels.includes(r) && result?.expanded
      ? (Array.from({ length: ROWS }, () => result.expanded!.symbol) as SymbolId[])
      : col,
  )

  // Líneas a dibujar en el overlay SVG: si el usuario apoya el mouse sobre un número de línea,
  // muestra esa línea; si no, cuando el giro frenó muestra todas las líneas ganadoras.
  const linesToDraw = useMemo(() => {
    if (hoveredLine !== null) {
      return [{ line: hoveredLine, count: 5 }]
    }
    if (spinning || !result) return []
    return result.lineWins.map((w) => ({ line: w.line, count: w.count }))
  }, [hoveredLine, spinning, result])

  const leftBadges = [3, 1, 0, 2, 4]  // Líneas 4, 2, 1, 3, 5
  const rightBadges = [5, 7, 9, 8, 6] // Líneas 6, 8, 10, 9, 7

  return (
    <div className="stage-wrap">
      <div className="line-pills" aria-label="Líneas izquierda">
        {leftBadges.map((lineIdx) => {
          const active = lineIdx < activeLines
          const won = !spinning && result?.lineWins.some((w) => w.line === lineIdx)
          return (
            <button
              key={lineIdx}
              type="button"
              className={`line-pill${active ? '' : ' line-pill-off'}${won ? ' line-pill-win' : ''}`}
              style={{ '--line-color': LINE_COLORS[lineIdx] } as React.CSSProperties}
              onMouseEnter={() => onHoverLine(lineIdx)}
              onMouseLeave={() => onHoverLine(null)}
              title={`Ver recorrido de Línea ${lineIdx + 1}`}
            >
              {lineIdx + 1}
            </button>
          )
        })}
      </div>

      <div className="reels-viewport">
        <div className="reels">
          {Array.from({ length: REELS }, (_, r) => (
            <Reel
              key={r}
              reel={r}
              symbols={grid[r]}
              spinning={spinning}
              spinMs={spinMs}
              delay={r * reelDelayMs}
              expanding={expandedReels.includes(r)}
              highlighted={spinning ? new Set() : highlighted}
              dim={!spinning && highlighted.size > 0 && expandedReels.length === 0 && hoveredLine === null}
            />
          ))}
        </div>

        {linesToDraw.length > 0 && (
          <svg
            className="paylines-svg"
            viewBox="0 0 500 300"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {linesToDraw.map(({ line, count }) => {
              const rows = LINES[line]
              const color = LINE_COLORS[line]
              const fullPoints = rows.map((row, r) => `${r * 100 + 50},${row * 100 + 50}`).join(' ')
              const winPoints = rows
                .slice(0, count)
                .map((row, r) => `${r * 100 + 50},${row * 100 + 50}`)
                .join(' ')
              return (
                <g key={line}>
                  <polyline
                    points={fullPoints}
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    strokeDasharray="6 6"
                    opacity="0.45"
                  />
                  <polyline
                    points={winPoints}
                    fill="none"
                    stroke={color}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {rows.slice(0, count).map((row, r) => (
                    <circle
                      key={r}
                      cx={r * 100 + 50}
                      cy={row * 100 + 50}
                      r="8"
                      fill={color}
                    />
                  ))}
                </g>
              )
            })}
          </svg>
        )}
      </div>

      <div className="line-pills" aria-label="Líneas derecha">
        {rightBadges.map((lineIdx) => {
          const active = lineIdx < activeLines
          const won = !spinning && result?.lineWins.some((w) => w.line === lineIdx)
          return (
            <button
              key={lineIdx}
              type="button"
              className={`line-pill${active ? '' : ' line-pill-off'}${won ? ' line-pill-win' : ''}`}
              style={{ '--line-color': LINE_COLORS[lineIdx] } as React.CSSProperties}
              onMouseEnter={() => onHoverLine(lineIdx)}
              onMouseLeave={() => onHoverLine(null)}
              title={`Ver recorrido de Línea ${lineIdx + 1}`}
            >
              {lineIdx + 1}
            </button>
          )
        })}
      </div>
    </div>
  )
}
