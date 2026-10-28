import { useCallback, useEffect, useRef, useState } from 'react'
import {
  forcePresetSpin,
  pickExpandingSymbol,
  resolveGamble,
  spin,
  type GambleCard,
  type GambleChoice,
  type SpinResult,
} from '../engine/engine'
import { BOOK, LINES, LINE_OPTIONS, type SymbolId } from '../engine/config'
import { sound } from './sound'

export const BETS = [1, 2, 5, 10, 25, 50]
const SPIN_MS = 680
const REEL_DELAY_MS = 135
const EXPAND_MS = 850
const REVEAL_MS = 2500

export type Phase = 'idle' | 'spinning' | 'expanding' | 'revealing'

export type SpinLogEntry = {
  id: number
  time: string
  bet: number
  lines: number
  cost: number
  stops: number[]
  win: number
  free: boolean
  books: number
  expanded?: SymbolId
}

export type Jackpots = {
  mini: number
  minor: number
  major: number
  grand: number
}

const STORAGE_BALANCE_KEY = 'promex_demo_balance_v1'
const STORAGE_XP_KEY = 'promex_demo_xp_v1'

function loadNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key)
    if (raw !== null) {
      const parsed = Number(raw)
      if (Number.isFinite(parsed) && parsed >= 0) return parsed
    }
  } catch {
    // ignore
  }
  return fallback
}

export function useSlot(initialBalance = 5000) {
  const [balance, setBalance] = useState(() => loadNumber(STORAGE_BALANCE_KEY, initialBalance))
  const [vipXp, setVipXp] = useState(() => loadNumber(STORAGE_XP_KEY, 120))
  const [bet, setBet] = useState(2)
  const [activeLines, setActiveLines] = useState<number>(LINES.length)
  const [result, setResult] = useState<SpinResult | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [freeSpinsLeft, setFreeSpinsLeft] = useState(0)
  const [expandingSymbol, setExpandingSymbol] = useState<SymbolId | null>(null)
  const [lastWin, setLastWin] = useState(0)
  const [roundWin, setRoundWin] = useState(0)
  const [autoplay, setAutoplay] = useState(false)
  const [muted, setMuted] = useState(() => sound.muted)
  const [hoveredLine, setHoveredLine] = useState<number | null>(null)

  // Estado de Gamble / Doblar (inspirado en `GambleRequest` de `Server.php`)
  const [gambleOpen, setGambleOpen] = useState(false)
  const [gambleAmount, setGambleAmount] = useState(0)
  const [gambleStep, setGambleStep] = useState(0)
  const [gambleHistory, setGambleHistory] = useState<GambleCard[]>([])
  const [gambleLastOutcome, setGambleLastOutcome] = useState<'win' | 'lose' | null>(null)

  // Pozos progresivos (`casino/app/JPG.php`)
  const [jackpots, setJackpots] = useState<Jackpots>({
    mini: 250,
    minor: 1250,
    major: 8500,
    grand: 45000,
  })

  // Historial de jugadas (`casino/app/GameLog.php`)
  const [history, setHistory] = useState<SpinLogEntry[]>([])
  const spinCounter = useRef(1)
  const timers = useRef<number[]>([])

  const cost = bet * activeLines
  const inFreeSpins = freeSpinsLeft > 0 || phase === 'revealing'
  const spinning = phase === 'spinning' || phase === 'expanding'
  const canSpin = phase === 'idle' && !gambleOpen && (freeSpinsLeft > 0 || balance >= cost)
  const canGamble =
    phase === 'idle' && !inFreeSpins && !autoplay && lastWin > 0 && !gambleOpen

  const vipLevel = Math.floor(vipXp / 500) + 1
  const vipProgressPct = Math.round(((vipXp % 500) / 500) * 100)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_BALANCE_KEY, String(balance))
    } catch {
      // ignore
    }
  }, [balance])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_XP_KEY, String(vipXp))
    } catch {
      // ignore
    }
  }, [vipXp])

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const toggleMute = useCallback(() => {
    const next = !muted
    sound.setMuted(next)
    setMuted(next)
  }, [muted])

  const executeSpin = useCallback(
    (preset?: 'free_spins' | 'big_win' | 'win') => {
      if (phase !== 'idle' || gambleOpen) return
      const free = freeSpinsLeft > 0
      if (!free && !preset && balance < cost) return

      const opts = {
        bet,
        activeLines,
        free,
        expandingSymbol: free ? expandingSymbol ?? undefined : undefined,
      }

      const r = preset ? forcePresetSpin(preset, opts) : spin(opts)

      sound.spinStart()
      setPhase('spinning')
      setLastWin(0)
      setHoveredLine(null)

      if (free) {
        setFreeSpinsLeft((n) => n - 1)
      } else {
        if (!preset || balance >= cost) {
          setBalance((b) => Math.max(0, b - cost))
        }
        setRoundWin(0)
        // Aporte a los 4 pozos JPG y progreso VIP
        setJackpots((jp) => ({
          mini: +(jp.mini + cost * 0.01).toFixed(1),
          minor: +(jp.minor + cost * 0.015).toFixed(1),
          major: +(jp.major + cost * 0.02).toFixed(1),
          grand: +(jp.grand + cost * 0.03).toFixed(1),
        }))
        setVipXp((xp) => {
          const nextXp = xp + Math.max(5, Math.round(cost * 0.5))
          if (Math.floor(nextXp / 500) > Math.floor(xp / 500)) {
            setBalance((b) => b + 250)
          }
          return nextXp
        })
      }

      setResult(r)

      // Sonido escalonado al frenar cada uno de los 5 rodillos
      for (let reelIdx = 0; reelIdx < 5; reelIdx++) {
        const stopTime = SPIN_MS + reelIdx * REEL_DELAY_MS
        const hasBook = r.grid[reelIdx].includes(BOOK)
        later(() => sound.reelStop(reelIdx, hasBook), stopTime)
      }

      const settleMs = SPIN_MS + REEL_DELAY_MS * 4 + 120
      const expands = (r.expanded?.reels.length ?? 0) > 0 && (r.expanded?.amount ?? 0) > 0

      const settle = () => {
        setLastWin(r.totalWin)
        if (r.totalWin > 0) {
          setBalance((b) => b + r.totalWin)
          if (free) setRoundWin((w) => w + r.totalWin)
          sound.win(r.totalWin >= cost * 15)
        }

        const now = new Date()
        const timeStr = now.toTimeString().slice(0, 8)
        const id = spinCounter.current++
        setHistory((prev) => [
          {
            id,
            time: timeStr,
            bet,
            lines: activeLines,
            cost: free ? 0 : cost,
            stops: r.stops,
            win: r.totalWin,
            free,
            books: r.bookCount,
            expanded: r.expanded?.symbol,
          },
          ...prev.slice(0, 24),
        ])

        if (r.freeSpinsAwarded > 0) {
          sound.freeSpinsTrigger()
          if (free) {
            setFreeSpinsLeft((n) => n + r.freeSpinsAwarded)
            setPhase('idle')
          } else {
            const chosen = pickExpandingSymbol()
            setPhase('revealing')
            setExpandingSymbol(chosen)
            setRoundWin(0)
            later(() => {
              setFreeSpinsLeft(r.freeSpinsAwarded)
              setPhase('idle')
            }, REVEAL_MS)
          }
        } else {
          setPhase('idle')
        }
      }

      if (expands) {
        later(() => {
          sound.expand()
          setPhase('expanding')
        }, settleMs)
        later(settle, settleMs + EXPAND_MS)
      } else {
        later(settle, settleMs)
      }
    },
    [phase, gambleOpen, freeSpinsLeft, balance, cost, bet, activeLines, expandingSymbol],
  )

  const doSpin = useCallback(() => executeSpin(), [executeSpin])

  // Abre el modal de Doblar descontando temporalmente `lastWin` del saldo ya acreditado
  const openGamble = useCallback(() => {
    if (!canGamble) return
    setBalance((b) => b - lastWin)
    setGambleAmount(lastWin)
    setGambleStep(0)
    setGambleLastOutcome(null)
    setGambleOpen(true)
  }, [canGamble, lastWin])

  const chooseGamble = useCallback(
    (choice: GambleChoice) => {
      if (!gambleOpen || gambleAmount <= 0 || gambleLastOutcome === 'lose') return
      const res = resolveGamble(gambleAmount, choice)
      sound.gambleFlip(res.won)
      setGambleHistory((h) => [res.card, ...h.slice(0, 7)])
      if (res.won) {
        const nextStep = gambleStep + 1
        setGambleAmount(res.nextAmount)
        setLastWin(res.nextAmount)
        setGambleStep(nextStep)
        setGambleLastOutcome('win')
        if (nextStep >= 5) {
          // Límite de 5 dobladas alcanzado: acredita automáticamente
          later(() => {
            setBalance((b) => b + res.nextAmount)
            setGambleOpen(false)
            setGambleAmount(0)
          }, 900)
        }
      } else {
        setGambleAmount(0)
        setLastWin(0)
        setGambleLastOutcome('lose')
        later(() => {
          setGambleOpen(false)
          setGambleLastOutcome(null)
        }, 1100)
      }
    },
    [gambleOpen, gambleAmount, gambleStep, gambleLastOutcome],
  )

  const collectGamble = useCallback(() => {
    if (!gambleOpen) return
    if (gambleAmount > 0) {
      setBalance((b) => b + gambleAmount)
      setLastWin(gambleAmount)
    }
    setGambleOpen(false)
    setGambleAmount(0)
    setGambleLastOutcome(null)
  }, [gambleOpen, gambleAmount])

  // Ejecución automática de giros gratis
  useEffect(() => {
    if (phase !== 'idle' || freeSpinsLeft <= 0 || gambleOpen) return
    const t = window.setTimeout(() => executeSpin(), 950)
    timers.current.push(t)
    return () => clearTimeout(t)
  }, [phase, freeSpinsLeft, gambleOpen, executeSpin])

  // Limpia el símbolo expandible al finalizar la ronda de bonus
  useEffect(() => {
    if (freeSpinsLeft === 0 && phase === 'idle' && expandingSymbol !== null) {
      const t = window.setTimeout(() => setExpandingSymbol(null), 2800)
      timers.current.push(t)
      return () => clearTimeout(t)
    }
  }, [freeSpinsLeft, phase, expandingSymbol])

  // Autoplay en juego base
  useEffect(() => {
    if (!autoplay || phase !== 'idle' || freeSpinsLeft > 0 || gambleOpen) return
    if (balance < cost) {
      setAutoplay(false)
      return
    }
    const t = window.setTimeout(() => executeSpin(), 680)
    timers.current.push(t)
    return () => clearTimeout(t)
  }, [autoplay, phase, freeSpinsLeft, gambleOpen, balance, cost, executeSpin])

  return {
    balance,
    bet,
    setBet,
    activeLines,
    setActiveLines,
    lineOptions: LINE_OPTIONS,
    result,
    phase,
    spinning,
    freeSpinsLeft,
    expandingSymbol,
    lastWin,
    roundWin,
    cost,
    canSpin,
    inFreeSpins,
    autoplay,
    setAutoplay,
    muted,
    toggleMute,
    hoveredLine,
    setHoveredLine,
    jackpots,
    vipLevel,
    vipXp,
    vipProgressPct,
    history,
    canGamble,
    gambleOpen,
    gambleAmount,
    gambleStep,
    gambleHistory,
    gambleLastOutcome,
    openGamble,
    chooseGamble,
    collectGamble,
    spin: doSpin,
    forceSpin: executeSpin,
    addCredits: () => setBalance((b) => b + 1000),
    resetBalance: () => setBalance(initialBalance),
    spinMs: SPIN_MS,
    reelDelayMs: REEL_DELAY_MS,
  }
}

export type SlotState = ReturnType<typeof useSlot>
