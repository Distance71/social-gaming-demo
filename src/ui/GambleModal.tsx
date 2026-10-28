import type { CardSuit, GambleCard, GambleChoice } from '../engine/engine'

const SUIT_GLYPH: Record<CardSuit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

const fmt = (n: number) => n.toLocaleString('es-AR')

type Props = {
  amount: number
  step: number
  history: GambleCard[]
  lastOutcome: 'win' | 'lose' | null
  onChoose: (choice: GambleChoice) => void
  onCollect: () => void
}

export function GambleModal({
  amount,
  step,
  history,
  lastOutcome,
  onChoose,
  onCollect,
}: Props) {
  const latestCard = history[0]
  const locked = lastOutcome === 'lose' || amount <= 0

  return (
    <div className="gamble-overlay" role="dialog" aria-label="Doblar premio">
      <div className="gamble-card-box">
        <div className="gamble-header">
          <div>
            <span className="gamble-badge">MODO DOBLAR · PASO {step}/5</span>
            <h3>Arriesgá o cobrá tu premio</h3>
          </div>
          <button type="button" className="gamble-collect-top" onClick={onCollect}>
            Cobrar {fmt(amount)}
          </button>
        </div>

        <div className="gamble-amounts">
          <div className="gamble-stat">
            <span>Premio en juego</span>
            <strong>{fmt(amount)}</strong>
          </div>
          <div className="gamble-stat gamble-stat-gold">
            <span>Color (×2)</span>
            <strong>{fmt(amount * 2)}</strong>
          </div>
          <div className="gamble-stat gamble-stat-purple">
            <span>Palo exacto (×4)</span>
            <strong>{fmt(amount * 4)}</strong>
          </div>
        </div>

        <div className="gamble-stage">
          <button
            type="button"
            className="gamble-btn gamble-btn-red"
            disabled={locked}
            onClick={() => onChoose('red')}
          >
            <span>ROJO ×2</span>
            <small>♥ ♦ (50%)</small>
          </button>

          <div
            className={`playing-card ${
              lastOutcome && latestCard ? `playing-card-${latestCard.color}` : 'playing-card-back'
            }`}
          >
            {lastOutcome && latestCard ? (
              <>
                <span className="card-corner">{latestCard.rank}{SUIT_GLYPH[latestCard.suit]}</span>
                <span className="card-center">{SUIT_GLYPH[latestCard.suit]}</span>
                <span className="card-status">
                  {lastOutcome === 'win' ? '¡ACERTASTE!' : 'PERDISTE'}
                </span>
              </>
            ) : (
              <span className="card-back-pattern">📖</span>
            )}
          </div>

          <button
            type="button"
            className="gamble-btn gamble-btn-black"
            disabled={locked}
            onClick={() => onChoose('black')}
          >
            <span>NEGRO ×2</span>
            <small>♣ ♠ (50%)</small>
          </button>
        </div>

        <div className="gamble-suits">
          {(['hearts', 'diamonds', 'clubs', 'spades'] as CardSuit[]).map((suit) => {
            const isRed = suit === 'hearts' || suit === 'diamonds'
            return (
              <button
                key={suit}
                type="button"
                className={`suit-btn ${isRed ? 'suit-red' : 'suit-black'}`}
                disabled={locked}
                onClick={() => onChoose(suit)}
              >
                <span className="suit-glyph">{SUIT_GLYPH[suit]}</span>
                <span>×4</span>
              </button>
            )
          })}
        </div>

        {history.length > 0 && (
          <div className="gamble-history">
            <span>Últimas cartas:</span>
            <div className="gamble-history-Row">
              {history.map((c, idx) => (
                <span key={idx} className={`mini-card mini-card-${c.color}`}>
                  {c.rank}{SUIT_GLYPH[c.suit]}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
