import fs from 'fs';
import path from 'path';

const SR = 22050; // 22.05 kHz for compact fast-loading web audio
const CH = 2;

function createWav(samples, filename) {
  const numSamples = samples.length;
  const dataSize = numSamples * 2; // 16-bit
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(CH, 22);
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * CH * 2, 28);
  header.writeUInt16LE(CH * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  const data = Buffer.alloc(dataSize);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const intSample = s < 0 ? s * 0x8000 : s * 0x7fff;
    data.writeInt16LE(Math.round(intSample), i * 2);
  }

  const outDir = path.dirname(filename);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(filename, Buffer.concat([header, data]));
  console.log(`Saved ${filename} (${(fs.statSync(filename).size / 1024).toFixed(1)} KB)`);
}

// Note frequencies in Hz
const N = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
  C6: 1046.50
};

// 1. Karplus-Strong string synthesis (Authentic Dombra / Plucked String)
function renderDombra(notes, bpm = 124) {
  const beatSec = 60 / bpm;
  const totalDuration = notes.reduce((acc, n) => acc + (n.beats || 1) * beatSec, 0) + 1.5;
  const totalSamples = Math.ceil(totalDuration * SR * CH);
  const out = new Float32Array(totalSamples);

  let currentSample = 0;

  for (const n of notes) {
    const durationSec = (n.beats || 1) * beatSec;
    const noteSamples = Math.floor(durationSec * SR);
    const freq = n.freq;

    if (freq > 0) {
      // 2 strings of dombra with slight detuning (d4 and g3)
      const freqs = [freq, freq * 1.002];
      for (const f of freqs) {
        const period = Math.round(SR / f);
        const ring = new Float32Array(period);
        for (let i = 0; i < period; i++) ring[i] = (Math.random() * 2 - 1) * 0.7;

        let ringIdx = 0;
        const decay = 0.993; // Dombra wooden decay
        const length = Math.min(SR * 2.5, Math.floor(SR * (durationSec * 1.4)));

        for (let i = 0; i < length; i++) {
          const nextIdx = (ringIdx + 1) % period;
          const val = (ring[ringIdx] + ring[nextIdx]) * 0.5 * decay;
          ring[ringIdx] = val;
          ringIdx = nextIdx;

          const outIdx = (currentSample + i) * CH;
          if (outIdx + 1 < totalSamples) {
            // stereo pan
            out[outIdx] += val * 0.35 * (n.vel || 1);
            out[outIdx + 1] += val * 0.33 * (n.vel || 1);
          }
        }
      }
    }
    currentSample += noteSamples;
  }

  // Gentle reverb
  applyReverb(out, 0.25, 0.45);
  normalize(out, 0.92);
  return out;
}

// 2. Piano & Bell synthesis (Waltz / Lullaby / Festive)
function renderPianoWaltz(chords, melody, bpm = 90) {
  const beatSec = 60 / bpm;
  const totalDuration = melody.reduce((acc, n) => acc + (n.beats || 1) * beatSec, 0) + 2.0;
  const totalSamples = Math.ceil(totalDuration * SR * CH);
  const out = new Float32Array(totalSamples);

  // Render melody (Bell / Piano tone)
  let curMelSample = 0;
  for (const m of melody) {
    const durSec = (m.beats || 1) * beatSec;
    const durSamples = Math.floor(durSec * SR);
    if (m.freq > 0) {
      const len = Math.floor(SR * Math.max(durSec * 1.5, 1.2));
      for (let i = 0; i < len; i++) {
        const t = i / SR;
        const env = Math.exp(-t * 2.8);
        const harm1 = Math.sin(2 * Math.PI * m.freq * t);
        const harm2 = 0.45 * Math.sin(2 * Math.PI * m.freq * 2 * t) * Math.exp(-t * 4);
        const harm3 = 0.25 * Math.sin(2 * Math.PI * m.freq * 3 * t) * Math.exp(-t * 6);
        const s = (harm1 + harm2 + harm3) * env * 0.35 * (m.vel || 1);
        const idx = (curMelSample + i) * CH;
        if (idx + 1 < totalSamples) {
          out[idx] += s * 0.9;
          out[idx + 1] += s * 1.0;
        }
      }
    }
    curMelSample += durSamples;
  }

  // Render accompaniment chords
  let curChordSample = 0;
  for (const ch of chords) {
    const durSec = (ch.beats || 3) * beatSec;
    const durSamples = Math.floor(durSec * SR);
    for (const f of ch.freqs) {
      const len = Math.floor(SR * Math.min(durSec * 1.3, 3.0));
      for (let i = 0; i < len; i++) {
        const t = i / SR;
        const env = Math.exp(-t * 1.5);
        const s = (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t)) * env * 0.14;
        const idx = (curChordSample + i) * CH;
        if (idx + 1 < totalSamples) {
          out[idx] += s * 0.8;
          out[idx + 1] += s * 0.8;
        }
      }
    }
    curChordSample += durSamples;
  }

  applyReverb(out, 0.32, 0.6);
  normalize(out, 0.92);
  return out;
}

// 3. Simple Delay / Reverb helper
function applyReverb(out, dryWet = 0.3, feedback = 0.5) {
  const delays = [Math.floor(SR * 0.045), Math.floor(SR * 0.085), Math.floor(SR * 0.13)];
  for (const d of delays) {
    for (let i = d * CH; i < out.length; i++) {
      out[i] += out[i - d * CH] * dryWet * feedback;
    }
  }
}

// Normalize amplitude to target
function normalize(out, target = 0.9) {
  let max = 0;
  for (let i = 0; i < out.length; i++) {
    const abs = Math.abs(out[i]);
    if (abs > max) max = abs;
  }
  if (max > 0.0001) {
    const mult = target / max;
    for (let i = 0; i < out.length; i++) out[i] *= mult;
  }
}

console.log('Generating audio tracks in public/audio/...');

// Track 1: Dombra Kyui - "Адай күйі"
const dombraNotes = [
  { freq: N.D4, beats: 0.5, vel: 1.1 },
  { freq: N.D4, beats: 0.5, vel: 0.9 },
  { freq: N.G4, beats: 1.0, vel: 1.2 },
  { freq: N.A4, beats: 0.5, vel: 1.0 },
  { freq: N.G4, beats: 0.5, vel: 0.9 },
  { freq: N.F4, beats: 1.0, vel: 1.0 },
  { freq: N.E4, beats: 0.5, vel: 0.9 },
  { freq: N.D4, beats: 0.5, vel: 1.0 },
  { freq: N.D4, beats: 1.0, vel: 1.2 },
  { freq: N.A4, beats: 0.5, vel: 1.1 },
  { freq: N.A4, beats: 0.5, vel: 1.0 },
  { freq: N.C5, beats: 1.0, vel: 1.3 },
  { freq: N.B4, beats: 0.5, vel: 1.0 },
  { freq: N.A4, beats: 0.5, vel: 0.9 },
  { freq: N.G4, beats: 1.0, vel: 1.1 },
  { freq: N.A4, beats: 1.0, vel: 1.0 },
  { freq: N.D4, beats: 2.0, vel: 1.2 },

  // Repeat & variation
  { freq: N.D4, beats: 0.5, vel: 1.0 },
  { freq: N.G4, beats: 0.5, vel: 1.1 },
  { freq: N.A4, beats: 1.0, vel: 1.2 },
  { freq: N.B4, beats: 0.5, vel: 1.1 },
  { freq: N.C5, beats: 0.5, vel: 1.2 },
  { freq: N.D5, beats: 1.5, vel: 1.4 },
  { freq: N.C5, beats: 0.5, vel: 1.0 },
  { freq: N.B4, beats: 0.5, vel: 0.9 },
  { freq: N.A4, beats: 0.5, vel: 1.0 },
  { freq: N.G4, beats: 1.0, vel: 1.1 },
  { freq: N.D4, beats: 2.0, vel: 1.2 },
];
createWav(renderDombra(dombraNotes, 138), 'public/audio/dombra_kyui.wav');

// Track 2: Mahabbat Valsi - Romantic Wedding Waltz
const waltzChords = [
  { freqs: [N.C3, N.G3, N.E4], beats: 3 },
  { freqs: [N.A3, N.E3, N.C4], beats: 3 },
  { freqs: [N.F3, N.C4, N.A4], beats: 3 },
  { freqs: [N.G3, N.D4, N.B4], beats: 3 },
  { freqs: [N.E3, N.B3, N.G4], beats: 3 },
  { freqs: [N.A3, N.E4, N.C5], beats: 3 },
  { freqs: [N.F3, N.C4, N.A4], beats: 3 },
  { freqs: [N.G3, N.D4, N.G4], beats: 3 },
  { freqs: [N.C3, N.G3, N.E4], beats: 3 },
];
const waltzMelody = [
  { freq: N.E5, beats: 1.5 }, { freq: N.G5, beats: 1.5 },
  { freq: N.C5, beats: 2.0 }, { freq: N.D5, beats: 1.0 },
  { freq: N.E5, beats: 2.0 }, { freq: N.F5, beats: 1.0 },
  { freq: N.D5, beats: 3.0 },
  { freq: N.G5, beats: 2.0 }, { freq: N.B5, beats: 1.0 },
  { freq: N.A5, beats: 2.0 }, { freq: N.E5, beats: 1.0 },
  { freq: N.F5, beats: 1.5 }, { freq: N.E5, beats: 1.5 },
  { freq: N.D5, beats: 3.0 },
  { freq: N.C5, beats: 3.0 },
];
createWav(renderPianoWaltz(waltzChords, waltzMelody, 88), 'public/audio/mahabbat_valsi.wav');

// Track 3: Zhar-Zhar - Traditional Wedding Song
const zharChords = [
  { freqs: [N.D3, N.A3, N.D4], beats: 4 },
  { freqs: [N.G3, N.D4, N.B4], beats: 4 },
  { freqs: [N.A3, N.E4, N.C5], beats: 4 },
  { freqs: [N.D3, N.A3, N.D4], beats: 4 },
  { freqs: [N.G3, N.D4, N.B4], beats: 4 },
  { freqs: [N.A3, N.E4, N.C5], beats: 4 },
  { freqs: [N.D3, N.A3, N.F4], beats: 4 },
];
const zharMelody = [
  { freq: N.D5, beats: 1.0 }, { freq: N.D5, beats: 0.5 }, { freq: N.E5, beats: 0.5 },
  { freq: N.F5, beats: 1.0 }, { freq: N.G5, beats: 1.0 },
  { freq: N.F5, beats: 1.0 }, { freq: N.E5, beats: 1.0 },
  { freq: N.D5, beats: 2.0 },
  { freq: N.F5, beats: 1.0 }, { freq: N.G5, beats: 1.0 },
  { freq: N.A5, beats: 1.5 }, { freq: N.G5, beats: 0.5 },
  { freq: N.F5, beats: 1.0 }, { freq: N.E5, beats: 1.0 },
  { freq: N.D5, beats: 2.0 },
];
createWav(renderPianoWaltz(zharChords, zharMelody, 96), 'public/audio/zhar_zhar.wav');

// Track 4: Kozimnin Qarasy - Classic Abay's Song
const abayChords = [
  { freqs: [N.A3, N.E4, N.C5], beats: 4 },
  { freqs: [N.D3, N.A3, N.F4], beats: 4 },
  { freqs: [N.E3, N.B3, N.G4], beats: 4 },
  { freqs: [N.A3, N.E4, N.C5], beats: 4 },
  { freqs: [N.F3, N.C4, N.A4], beats: 4 },
  { freqs: [N.E3, N.B3, N.G4], beats: 4 },
  { freqs: [N.A3, N.E4, N.A4], beats: 4 },
];
const abayMelody = [
  { freq: N.E5, beats: 1.5 }, { freq: N.D5, beats: 0.5 }, { freq: N.C5, beats: 1.0 }, { freq: N.B4, beats: 1.0 },
  { freq: N.A4, beats: 2.0 }, { freq: N.D5, beats: 2.0 },
  { freq: N.B4, beats: 1.5 }, { freq: N.A4, beats: 0.5 }, { freq: N.G4, beats: 1.0 }, { freq: N.B4, beats: 1.0 },
  { freq: N.A4, beats: 3.0 }, { freq: 0, beats: 1.0 },
  { freq: N.C5, beats: 1.5 }, { freq: N.D5, beats: 0.5 }, { freq: N.E5, beats: 2.0 },
  { freq: N.D5, beats: 1.5 }, { freq: N.B4, beats: 0.5 }, { freq: N.G4, beats: 2.0 },
  { freq: N.A4, beats: 4.0 },
];
createWav(renderPianoWaltz(abayChords, abayMelody, 80), 'public/audio/kozimnin_qarasy.wav');

// Track 5: Besik Zhyry - Gentle Lullaby (Celesta & Music Box)
const besikChords = [
  { freqs: [N.C3, N.G3, N.E4], beats: 3 },
  { freqs: [N.F3, N.C4, N.A4], beats: 3 },
  { freqs: [N.G3, N.D4, N.B4], beats: 3 },
  { freqs: [N.C3, N.G3, N.E4], beats: 3 },
  { freqs: [N.A3, N.E4, N.C5], beats: 3 },
  { freqs: [N.D3, N.A3, N.F4], beats: 3 },
  { freqs: [N.G3, N.D4, N.B4], beats: 3 },
  { freqs: [N.C3, N.G3, N.C5], beats: 3 },
];
const besikMelody = [
  { freq: N.G5, beats: 2.0 }, { freq: N.E5, beats: 1.0 },
  { freq: N.A5, beats: 2.0 }, { freq: N.F5, beats: 1.0 },
  { freq: N.G5, beats: 1.5 }, { freq: N.F5, beats: 0.5 }, { freq: N.D5, beats: 1.0 },
  { freq: N.E5, beats: 3.0 },
  { freq: N.E5, beats: 1.5 }, { freq: N.F5, beats: 0.5 }, { freq: N.G5, beats: 1.0 },
  { freq: N.F5, beats: 1.5 }, { freq: N.D5, beats: 0.5 }, { freq: N.B4, beats: 1.0 },
  { freq: N.C5, beats: 3.0 },
];
createWav(renderPianoWaltz(besikChords, besikMelody, 74), 'public/audio/besik_zhyry.wav');

// Track 6: Toy Bastar - Festive Celebration
const toyNotes = [
  { freq: N.G4, beats: 0.5, vel: 1.2 },
  { freq: N.G4, beats: 0.5, vel: 1.0 },
  { freq: N.C5, beats: 1.0, vel: 1.3 },
  { freq: N.E5, beats: 0.5, vel: 1.1 },
  { freq: N.D5, beats: 0.5, vel: 1.0 },
  { freq: N.C5, beats: 1.0, vel: 1.2 },
  { freq: N.G4, beats: 0.5, vel: 1.0 },
  { freq: N.A4, beats: 0.5, vel: 1.0 },
  { freq: N.B4, beats: 1.0, vel: 1.1 },
  { freq: N.C5, beats: 1.5, vel: 1.3 },
  { freq: N.D5, beats: 0.5, vel: 1.1 },
  { freq: N.E5, beats: 1.0, vel: 1.2 },
  { freq: N.F5, beats: 0.5, vel: 1.1 },
  { freq: N.E5, beats: 0.5, vel: 1.0 },
  { freq: N.D5, beats: 1.0, vel: 1.1 },
  { freq: N.C5, beats: 2.0, vel: 1.3 },
];
createWav(renderDombra(toyNotes, 130), 'public/audio/toy_bastar.wav');

console.log('All audio tracks generated successfully!');
