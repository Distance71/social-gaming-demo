# PROMEX Social Gaming · Demo 1 Juego en React (`Libro del Nilo DX`)

Versión funcional en React + TypeScript inspirada en [`promexdotme/laravel-social-gaming`](https://github.com/promexdotme/laravel-social-gaming), tomando la arquitectura de `casino/app/Games/BookOfNileNG/` (`Server.php`, `SlotSettings.php`, `GameReel.php`) junto con los módulos de plataforma (`JPG.php` pozos progresivos, `Progress.php` niveles VIP y `GameLog.php` historial auditable).

## Comandos rápidos

```bash
npm run dev     # Levanta la app en http://localhost:5173
npm test        # Corre los 15 tests unitarios del motor (node:test)
npm run rtp     # Simula 1.000.000 de giros y reporta el RTP desglosado
npm run reels   # Regenera src/engine/reels.json con semilla determinística
npm run build   # Compila TypeScript y genera el bundle de producción
```

## Qué incluye esta demo

1. **Motor puro desacoplado de React (`src/engine/`)**:
   - **Grilla 5×3 y 10 líneas configurables** (1, 3, 5, 7 o 10 líneas activas) idénticas a `Server.php`.
   - **Libro Sagrado (`BOOK = 1`) dual**: funciona como **Wild** (sustituye símbolos en línea y compara prefijos puros de Libros vs sustitución para pagar siempre la combinación más alta) y como **Scatter** (paga 2×, 20× y 200× la apuesta total desde cualquier posición).
   - **Ronda Bonus de 10 Giros Gratis + Símbolo Expandible (`DoMysteryScatter`)**: con 3+ Libros se sortea un símbolo especial que, cuando cae en suficientes rodillos para formar premio (2+ para figuras altas, 3+ para letras), se expande cubriendo el rodillo entero y paga en todas las líneas activas sin necesidad de adyacencia. Incluye **Retrigger (+5 giros)**.
   - **Modo Doblar / Gamble (`GambleRequest`)**: después de cualquier premio en el juego base, permite arriesgar el premio al color (Rojo/Negro ×2) o al palo exacto (♥/♦/♣/♠ ×4) hasta 5 veces seguidas.
2. **Elementos de la suite social (`promexdotme/laravel-social-gaming`)**:
   - **Pozos Progresivos (`JPG.php`)**: `GRAND`, `MAJOR`, `MINOR` y `MINI` que incrementan con cada giro.
   - **Progresión VIP (`Progress.php`)**: barra de experiencia que sube con cada apuesta y otorga bonos de `+250 créditos` al subir de nivel.
   - **Persistencia local (`localStorage`)**: el saldo y nivel VIP se conservan al recargar la página.
   - **Audio procedural Web Audio API (`src/ui/sound.ts`)**: efectos sintetizados en tiempo real sin depender de archivos externos.
   - **Barra Modo Demo / QA**: botones para forzar en 1 clic **3 Libros (Giros Gratis)**, **5 Exploradores (3500×)** o un **Premio para probar el modo Doblar** buscando paradas reales en las tiras.
