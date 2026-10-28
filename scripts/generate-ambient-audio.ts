import fs from 'fs';
import path from 'path';

const SAMPLE_RATE = 44100;

interface SynthNote {
  freq: number;
  gain: number;
  detune?: number;
}

function writeWavHeader(samplesCount: number, numChannels = 2, sampleRate = 44100): Buffer {
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samplesCount * blockAlign;
  const buffer = Buffer.alloc(44);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // SubChunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // BitsPerSample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

function floatTo16BitPcm(floatVal: number): number {
  const clamped = Math.max(-1, Math.min(1, floatVal));
  return clamped < 0 ? Math.floor(clamped * 32768) : Math.floor(clamped * 32767);
}

// Generate Solar Temple Ambiance (Golden Desert / Celestial Observatory)
function generateSolarTemple(durationSec = 20): { left: Float32Array; right: Float32Array } {
  const totalSamples = Math.floor(SAMPLE_RATE * durationSec);
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  // Musical notes in D celestial solar mode (D2, A2, D3, F#3, A3, C#4, E4)
  const padFrequencies = [
    { freq: 73.42, amp: 0.28, pan: 0.0 },   // D2 sub-drone
    { freq: 110.00, amp: 0.22, pan: -0.2 }, // A2 warm fifth
    { freq: 146.83, amp: 0.18, pan: 0.2 },  // D3
    { freq: 185.00, amp: 0.12, pan: -0.3 }, // F#3 golden major third
    { freq: 220.00, amp: 0.10, pan: 0.3 },  // A3
    { freq: 277.18, amp: 0.07, pan: -0.4 }, // C#4 celestial seventh
    { freq: 329.63, amp: 0.06, pan: 0.4 },  // E4 ninth
  ];

  // Chime intervals (temple sistrum bells ringing periodically)
  const bellEvents = [
    { time: 1.5, freq: 587.33, pan: -0.4 }, // D5
    { time: 5.5, freq: 739.99, pan: 0.5 },  // F#5
    { time: 9.0, freq: 880.00, pan: -0.3 }, // A5
    { time: 13.5, freq: 1108.73, pan: 0.4 },// C#6
    { time: 17.0, freq: 880.00, pan: 0.1 }, // A5
  ];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;

    // 1. Warm Analog Solar Drone with breathing LFO filter
    const lfoBreathing = 0.5 + 0.5 * Math.sin(2 * Math.PI * (t / 8.0)); // 8-second slow breath
    const lfoFilter = 0.6 + 0.4 * Math.sin(2 * Math.PI * (t / 10.0));

    let padL = 0;
    let padR = 0;

    for (const voice of padFrequencies) {
      // Warm layered sine + soft triangle + slight chorus detune
      const phase1 = 2 * Math.PI * voice.freq * t;
      const phase2 = 2 * Math.PI * (voice.freq * 1.002) * t + 0.3;
      const wave = Math.sin(phase1) * 0.7 + Math.sin(phase2) * 0.3;
      const panL = 0.5 - voice.pan * 0.5;
      const panR = 0.5 + voice.pan * 0.5;

      padL += wave * voice.amp * panL * lfoFilter;
      padR += wave * voice.amp * panR * lfoFilter;
    }

    // 2. High Celestial Shimmer (A4 + D5 harmonics with gentle tremolo)
    const shimmerLfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * 3.5 * t);
    const shimmerWave = Math.sin(2 * Math.PI * 587.33 * t) * 0.03 * shimmerLfo;
    padL += shimmerWave * 0.4;
    padR += shimmerWave * 0.6;

    // 3. Temple Sistrum / Bell Chimes
    let bellsL = 0;
    let bellsR = 0;
    for (const bell of bellEvents) {
      const dt = t - bell.time;
      if (dt >= 0 && dt < 4.0) {
        const decay = Math.exp(-dt * 2.2);
        // Rich metallic bell harmonic series: 1x, 2.75x, 5.4x
        const f0 = bell.freq;
        const bWave =
          Math.sin(2 * Math.PI * f0 * dt) * 0.6 +
          Math.sin(2 * Math.PI * f0 * 2.756 * dt) * 0.3 +
          Math.sin(2 * Math.PI * f0 * 5.404 * dt) * 0.15;
        const bPanL = 0.5 - bell.pan * 0.5;
        const bPanR = 0.5 + bell.pan * 0.5;
        bellsL += bWave * decay * 0.09 * bPanL;
        bellsR += bWave * decay * 0.09 * bPanR;
      }
    }

    // 4. Subtle warm desert wind sweep (low noise)
    const windNoise = (Math.random() * 2 - 1) * 0.012 * (0.6 + 0.4 * Math.sin(2 * Math.PI * (t / 6.0)));

    left[i] = padL + bellsL + windNoise;
    right[i] = padR + bellsR + windNoise;
  }

  return { left, right };
}

// Generate Prism Cavern Ambiance (Crystal Cave / Bioluminescent Grotto)
function generatePrismCavern(durationSec = 20): { left: Float32Array; right: Float32Array } {
  const totalSamples = Math.floor(SAMPLE_RATE * durationSec);
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  // Crystal cave notes in C minor ethereal scale (C2, G2, Eb3, G3, Bb3, D4, F4)
  const padVoices = [
    { freq: 65.41, amp: 0.30, pan: 0.0 },   // C2 deep cavern sub
    { freq: 98.00, amp: 0.22, pan: -0.2 },  // G2
    { freq: 155.56, amp: 0.16, pan: 0.25 }, // Eb3 mystical minor 3rd
    { freq: 196.00, amp: 0.14, pan: -0.25 },// G3
    { freq: 233.08, amp: 0.10, pan: 0.3 },  // Bb3
    { freq: 293.66, amp: 0.08, pan: -0.35 },// D4 ninth
    { freq: 349.23, amp: 0.06, pan: 0.4 },  // F4 eleventh
  ];

  // Periodic crystal droplets / resonant chimes
  const crystalDrops = [
    { time: 0.8, freq: 1046.5, pan: -0.6 },  // C6
    { time: 3.2, freq: 1318.5, pan: 0.5 },   // E6
    { time: 5.6, freq: 1567.98, pan: -0.4 }, // G6
    { time: 8.4, freq: 2093.0, pan: 0.6 },   // C7
    { time: 11.2, freq: 1174.66, pan: -0.5 },// D6
    { time: 14.0, freq: 1567.98, pan: 0.3 }, // G6
    { time: 16.8, freq: 1760.0, pan: -0.3 }, // A6
  ];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;

    // Slow ambient wave modulation (cavern pulse)
    const cavernLfo = 0.7 + 0.3 * Math.sin(2 * Math.PI * (t / 7.0));

    let padL = 0;
    let padR = 0;

    for (const voice of padVoices) {
      const p1 = 2 * Math.PI * voice.freq * t;
      const p2 = 2 * Math.PI * (voice.freq * 0.998) * t + 0.8;
      const wave = Math.sin(p1) * 0.65 + Math.sin(p2) * 0.35;
      const panL = 0.5 - voice.pan * 0.5;
      const panR = 0.5 + voice.pan * 0.5;

      padL += wave * voice.amp * panL * cavernLfo;
      padR += wave * voice.amp * panR * cavernLfo;
    }

    // High crystalline shimmer (glassy vibration)
    const glassLfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * 4.8 * t);
    const glassWave = (Math.sin(2 * Math.PI * 1760 * t) + Math.sin(2 * Math.PI * 2349.3 * t)) * 0.018 * glassLfo;
    padL += glassWave * 0.7;
    padR += glassWave * 0.3;

    // Crystal droplets with lush ping-pong echo
    let dropsL = 0;
    let dropsR = 0;
    for (const drop of crystalDrops) {
      const dt = t - drop.time;
      if (dt >= 0 && dt < 3.5) {
        // Main drop strike
        const mainDecay = Math.exp(-dt * 4.0);
        const strike = Math.sin(2 * Math.PI * drop.freq * dt) * mainDecay * 0.12;

        // First echo (delayed by 0.22s, opposite ear)
        let echo1 = 0;
        if (dt >= 0.22) {
          const dt1 = dt - 0.22;
          echo1 = Math.sin(2 * Math.PI * (drop.freq * 0.995) * dt1) * Math.exp(-dt1 * 3.5) * 0.055;
        }

        // Second echo (delayed by 0.44s)
        let echo2 = 0;
        if (dt >= 0.44) {
          const dt2 = dt - 0.44;
          echo2 = Math.sin(2 * Math.PI * drop.freq * dt2) * Math.exp(-dt2 * 3.0) * 0.025;
        }

        const dPanL = 0.5 - drop.pan * 0.5;
        const dPanR = 0.5 + drop.pan * 0.5;

        dropsL += strike * dPanL + echo1 * (1 - dPanL) + echo2 * dPanL;
        dropsR += strike * dPanR + echo1 * (1 - dPanR) + echo2 * dPanR;
      }
    }

    left[i] = padL + dropsL;
    right[i] = padR + dropsR;
  }

  return { left, right };
}

// Generate VIP Casino Lounge Ambiance (Warm Rhodes / Subtle High-Roller Chords)
function generateLobbyLounge(durationSec = 20): { left: Float32Array; right: Float32Array } {
  const totalSamples = Math.floor(SAMPLE_RATE * durationSec);
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  // Smooth jazz chord progression:
  // 0s-10s: Fmaj9 (F2, C3, A3, C4, E4, G4)
  // 10s-20s: Dm9 (D2, A2, F3, C4, E4)
  const chord1 = [
    { freq: 87.31, amp: 0.25, pan: 0.0 },  // F2
    { freq: 130.81, amp: 0.20, pan: -0.2 },// C3
    { freq: 220.00, amp: 0.15, pan: 0.2 }, // A3
    { freq: 261.63, amp: 0.14, pan: -0.3 },// C4
    { freq: 329.63, amp: 0.12, pan: 0.3 }, // E4
    { freq: 392.00, amp: 0.10, pan: -0.1 },// G4
  ];

  const chord2 = [
    { freq: 73.42, amp: 0.25, pan: 0.0 },  // D2
    { freq: 110.00, amp: 0.20, pan: -0.2 },// A2
    { freq: 174.61, amp: 0.15, pan: 0.2 }, // F3
    { freq: 261.63, amp: 0.14, pan: -0.3 },// C4
    { freq: 329.63, amp: 0.12, pan: 0.3 }, // E4
  ];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    const isChord1 = t < 10.0;
    const chordTime = isChord1 ? t : t - 10.0;
    const chord = isChord1 ? chord1 : chord2;

    // Crossfade envelope between chords (smooth swell)
    const swell = Math.sin(Math.PI * (chordTime / 10.0));

    let padL = 0;
    let padR = 0;

    for (const voice of chord) {
      // Warm Rhodes-like tone: fundamental + mild 2nd harmonic + soft tremolo
      const trem = 0.9 + 0.1 * Math.sin(2 * Math.PI * 2.2 * t);
      const wave = (Math.sin(2 * Math.PI * voice.freq * t) * 0.8 + Math.sin(2 * Math.PI * voice.freq * 2 * t) * 0.2) * trem;
      const panL = 0.5 - voice.pan * 0.5;
      const panR = 0.5 + voice.pan * 0.5;

      padL += wave * voice.amp * panL * swell;
      padR += wave * voice.amp * panR * swell;
    }

    // Subtle luxury vinyl air
    const vinylAir = (Math.random() * 2 - 1) * 0.004;

    left[i] = padL + vinylAir;
    right[i] = padR + vinylAir;
  }

  return { left, right };
}

// Make audio buffer seamless by crossfading tail into head
function makeSeamlessLoop(
  raw: { left: Float32Array; right: Float32Array },
  crossfadeSec = 2.0
): { left: Float32Array; right: Float32Array } {
  const crossfadeSamples = Math.floor(SAMPLE_RATE * crossfadeSec);
  const origLen = raw.left.length;
  const finalLen = origLen - crossfadeSamples;

  const left = new Float32Array(finalLen);
  const right = new Float32Array(finalLen);

  // Copy non-overlapping body
  for (let i = 0; i < finalLen; i++) {
    left[i] = raw.left[i];
    right[i] = raw.right[i];
  }

  // Crossfade the tail (from finalLen to origLen) onto the head (0 to crossfadeSamples)
  for (let i = 0; i < crossfadeSamples; i++) {
    const alpha = i / crossfadeSamples; // 0 -> 1
    // fade out the tail, fade in the head
    const tailIdx = finalLen + i;
    left[i] = left[i] * alpha + raw.left[tailIdx] * (1 - alpha);
    right[i] = right[i] * alpha + raw.right[tailIdx] * (1 - alpha);
  }

  return { left, right };
}

function saveToWavFile(audio: { left: Float32Array; right: Float32Array }, outPath: string) {
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const samplesCount = audio.left.length;
  const header = writeWavHeader(samplesCount, 2, SAMPLE_RATE);
  const pcmData = Buffer.alloc(samplesCount * 4); // 2 channels * 2 bytes

  let offset = 0;
  for (let i = 0; i < samplesCount; i++) {
    pcmData.writeInt16LE(floatTo16BitPcm(audio.left[i]), offset);
    offset += 2;
    pcmData.writeInt16LE(floatTo16BitPcm(audio.right[i]), offset);
    offset += 2;
  }

  const fileData = Buffer.concat([header, pcmData]);
  fs.writeFileSync(outPath, fileData);
  console.log(`Saved: ${outPath} (${(fileData.length / 1024 / 1024).toFixed(2)} MB, duration: ${(samplesCount / SAMPLE_RATE).toFixed(1)}s)`);
}

async function main() {
  console.log('Generating distinct ambient background soundscapes...');

  // 1. Solar Temple (Solar Wheel) - 22s raw -> 20s seamless loop
  const solarRaw = generateSolarTemple(22);
  const solarLoop = makeSeamlessLoop(solarRaw, 2.0);
  saveToWavFile(solarLoop, 'public/cedar/games/CedarWheel/audio/ambient-solar-temple.wav');

  // 2. Prism Cavern (Prism Plinko) - 22s raw -> 20s seamless loop
  const plinkoRaw = generatePrismCavern(22);
  const plinkoLoop = makeSeamlessLoop(plinkoRaw, 2.0);
  saveToWavFile(plinkoLoop, 'public/cedar/games/CedarPlinko/audio/ambient-prism-cavern.wav');

  // 3. VIP Casino Lounge (Catálogo / Lobby) - 22s raw -> 20s seamless loop
  const loungeRaw = generateLobbyLounge(22);
  const loungeLoop = makeSeamlessLoop(loungeRaw, 2.0);
  saveToWavFile(loungeLoop, 'public/audio/ambient-casino-lounge.wav');

  console.log('ALL AMBIENT AUDIO TRACKS GENERATED SUCCESSFULLY!');
}

main().catch(console.error);
