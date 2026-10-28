import { BOOK, LINES, LINE_COLORS, PAYTABLE, SCATTER_PAY, SYMBOLS } from '../engine/config'
import { SYMBOL_ART } from './symbols'

const fmt = (n: number) => n.toLocaleString('es-AR')

export function Paytable({ bet, activeLines }: { bet: number; activeLines: number }) {
  const paying = SYMBOLS.filter((s) => s !== BOOK)
  const totalBet = bet * activeLines

  return (
    <div className="paytable">
      <div className="paytable-intro">
        <div>
          <h2>Tabla de Pagos Dinámica</h2>
          <p>
            Mostrando premios en créditos para tu apuesta actual (<b>{fmt(bet)}</b> por línea ·{' '}
            <b>{activeLines}</b> líneas · apuesta total <b>{fmt(totalBet)}</b>).
          </p>
        </div>
      </div>

      <div className="paytable-head">
        <span>Símbolo</span>
        <span>×2</span>
        <span>×3</span>
        <span>×4</span>
        <span>×5</span>
      </div>

      {paying.map((s) => (
        <div className="paytable-row" key={s}>
          <span className="paytable-sym" style={{ color: SYMBOL_ART[s].color }}>
            <b>{SYMBOL_ART[s].glyph}</b> {SYMBOL_ART[s].label}
          </span>
          {[2, 3, 4, 5].map((n) => {
            const val = (PAYTABLE[s][n] ?? 0) * bet
            return <span key={n}>{val ? fmt(val) : '—'}</span>
          })}
        </div>
      ))}

      <div className="paytable-row paytable-book">
        <span className="paytable-sym" style={{ color: SYMBOL_ART[BOOK].color }}>
          <b>{SYMBOL_ART[BOOK].glyph}</b> Libro (Scatter + Wild)
        </span>
        <span>—</span>
        {[3, 4, 5].map((n) => (
          <span key={n}>{fmt(SCATTER_PAY[n] * totalBet)}</span>
        ))}
      </div>

      <div className="paytable-rules">
        <div className="rule-card">
          <h4>📖 Libro Sagrado (Wild + Scatter)</h4>
          <p>
            Sustituye a cualquier símbolo en una línea de pago (evaluada de izquierda a derecha
            desde el rodillo 1). Además, 3 o más Libros en cualquier posición pagan sobre la
            apuesta total y activan <b>10 Giros Gratis</b>.
          </p>
        </div>
        <div className="rule-card">
          <h4>✨ Símbolo Expandible en Giros Gratis</h4>
          <p>
            Al iniciar los 10 Giros Gratis se sortea un Símbolo Especial (`DoMysteryScatter`). Cuando
            caen suficientes rodillos con ese símbolo (2+ en figuras altas, 3+ en letras), el
            símbolo se expande cubriendo las 3 filas y paga en todas las líneas activas aunque los
            rodillos no sean contiguos.
          </p>
        </div>
      </div>

      <h4 className="lines-grid-title">Las 10 Líneas de Pago (`Server.php`)</h4>
      <div className="lines-mini-grid">
        {LINES.map((rows, lIdx) => (
          <div
            key={lIdx}
            className={`line-diagram${lIdx < activeLines ? '' : ' line-diagram-off'}`}
          >
            <span className="line-diagram-label" style={{ color: LINE_COLORS[lIdx] }}>
              Línea {lIdx + 1}
            </span>
            <div className="line-diagram-cells">
              {[0, 1, 2].map((row) =>
                [0, 1, 2, 3, 4].map((reel) => {
                  const hit = rows[reel] === row
                  return (
                    <span
                      key={`${reel}-${row}`}
                      className="line-dot"
                      style={{
                        background: hit ? LINE_COLORS[lIdx] : 'rgba(255,255,255,0.07)',
                      }}
                    />
                  )
                }),
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
