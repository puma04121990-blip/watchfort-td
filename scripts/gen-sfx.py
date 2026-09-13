#!/usr/bin/env python3
"""Synthesize Watchfort game-like SFX + BGM loops → WAV → .ogg + .m4a."""

from __future__ import annotations

import math
import shutil
import struct
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT_DIRS = [ROOT / "public" / "assets" / "audio", ROOT / "assets" / "audio"]
TMP = ROOT / "scripts" / ".sfx-tmp"
SR = 44100
RNG = np.random.default_rng(42)


def clamp(x: np.ndarray, lo: float = -1.0, hi: float = 1.0) -> np.ndarray:
    return np.clip(x, lo, hi).astype(np.float64)


def env_adsr(
    n: int,
    attack: float,
    decay: float,
    sustain: float,
    release: float,
    sus_level: float = 0.7,
) -> np.ndarray:
    a = max(1, int(attack * SR))
    d = max(1, int(decay * SR))
    r = max(1, int(release * SR))
    s = max(0, n - a - d - r)
    if a + d + s + r > n:
        s = max(0, n - a - d - r)
        if a + d + s + r > n:
            r = max(1, n - a - d - s)
    parts = []
    parts.append(np.linspace(0.0, 1.0, a, endpoint=False))
    parts.append(np.linspace(1.0, sus_level, d, endpoint=False))
    if s:
        parts.append(np.full(s, sus_level))
    parts.append(np.linspace(sus_level, 0.0, r))
    e = np.concatenate(parts)[:n]
    if len(e) < n:
        e = np.pad(e, (0, n - len(e)))
    return e.astype(np.float64)


def soft_square(t: np.ndarray, freq: np.ndarray | float, soft: float = 0.25) -> np.ndarray:
    phase = 2 * np.pi * np.cumsum(np.atleast_1d(freq).astype(np.float64) / SR)
    if np.isscalar(freq):
        phase = 2 * np.pi * freq * t
    raw = np.sign(np.sin(phase) + 1e-12)
    # soft edges via tanh of sine
    return np.tanh(np.sin(phase) / max(soft, 0.05))


def soft_saw(t: np.ndarray, freq: float) -> np.ndarray:
    phase = (freq * t) % 1.0
    return 2.0 * phase - 1.0


def noise(n: int, color: str = "white") -> np.ndarray:
    x = RNG.standard_normal(n)
    if color == "brown":
        x = np.cumsum(x)
        x /= max(np.max(np.abs(x)), 1e-9)
    elif color == "pink":
        # crude 1/f via cumulative smoothing
        x = np.convolve(x, np.ones(8) / 8, mode="same")
        x /= max(np.max(np.abs(x)), 1e-9)
    return x.astype(np.float64)


def lowpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    rc = 1.0 / (2 * math.pi * cutoff)
    dt = 1.0 / SR
    alpha = dt / (rc + dt)
    y = np.zeros_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += alpha * (v - acc)
        y[i] = acc
    return y


def highpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    rc = 1.0 / (2 * math.pi * cutoff)
    dt = 1.0 / SR
    alpha = rc / (rc + dt)
    y = np.zeros_like(x)
    prev_x = x[0] if len(x) else 0.0
    prev_y = 0.0
    for i, v in enumerate(x):
        prev_y = alpha * (prev_y + v - prev_x)
        prev_x = v
        y[i] = prev_y
    return y


def write_wav(path: Path, samples: np.ndarray) -> None:
    samples = clamp(samples)
    pcm = (samples * 32767.0).astype(np.int16)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def encode(wav: Path, stem: str) -> None:
    for out_dir in OUT_DIRS:
        out_dir.mkdir(parents=True, exist_ok=True)
        ogg = out_dir / f"{stem}.ogg"
        m4a = out_dir / f"{stem}.m4a"
        subprocess.run(
            [
                "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                "-i", str(wav),
                "-c:a", "libvorbis", "-q:a", "4",
                str(ogg),
            ],
            check=True,
        )
        subprocess.run(
            [
                "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                "-i", str(wav),
                "-c:a", "aac", "-b:a", "128k",
                str(m4a),
            ],
            check=True,
        )


def normalize(x: np.ndarray, peak: float = 0.85) -> np.ndarray:
    m = np.max(np.abs(x))
    if m < 1e-9:
        return x
    return x * (peak / m)


# ── clip generators ──────────────────────────────────────────────

def gen_click() -> np.ndarray:
    dur = 0.08
    n = int(SR * dur)
    t = np.arange(n) / SR
    freq = np.linspace(920, 640, n)
    tone = soft_square(t, freq, soft=0.35) * 0.55
    click = highpass(noise(n) * env_adsr(n, 0.001, 0.01, 0.0, 0.04, 0.2), 2000) * 0.25
    return normalize((tone + click) * env_adsr(n, 0.002, 0.02, 0.02, 0.04, 0.4))


def gen_confirm() -> np.ndarray:
    dur = 0.15
    n = int(SR * dur)
    t = np.arange(n) / SR
    a = soft_square(t, 520, 0.3) * env_adsr(n, 0.005, 0.04, 0.04, 0.06, 0.5)
    b = soft_square(t, 780, 0.3) * env_adsr(n, 0.04, 0.03, 0.04, 0.05, 0.45)
    return normalize(a * 0.6 + b * 0.55)


def gen_error() -> np.ndarray:
    dur = 0.15
    n = int(SR * dur)
    freq = np.linspace(220, 110, n)
    phase = 2 * np.pi * np.cumsum(freq / SR)
    tone = np.tanh(np.sin(phase) * 2.2)
    buzz = lowpass(noise(n, "brown"), 600) * 0.35
    return normalize((tone * 0.7 + buzz) * env_adsr(n, 0.005, 0.04, 0.06, 0.05, 0.55))


def gen_place() -> np.ndarray:
    dur = 0.12
    n = int(SR * dur)
    t = np.arange(n) / SR
    thud = lowpass(noise(n, "brown"), 280) * env_adsr(n, 0.002, 0.03, 0.02, 0.06, 0.35)
    blip = soft_square(t, np.linspace(280, 420, n), 0.4) * env_adsr(n, 0.01, 0.03, 0.03, 0.05, 0.4)
    return normalize(thud * 0.9 + blip * 0.55)


def gen_shot_arrow() -> np.ndarray:
    dur = 0.08
    n = int(SR * dur)
    t = np.arange(n) / SR
    whoosh = highpass(noise(n, "pink"), 1200) * env_adsr(n, 0.001, 0.015, 0.02, 0.04, 0.3)
    zip_f = np.linspace(1400, 600, n)
    zip_tone = soft_square(t, zip_f, 0.5) * env_adsr(n, 0.001, 0.02, 0.01, 0.04, 0.25)
    return normalize(whoosh * 0.7 + zip_tone * 0.45)


def gen_shot_cannon() -> np.ndarray:
    dur = 0.18
    n = int(SR * dur)
    boom = lowpass(noise(n, "brown"), 180) * env_adsr(n, 0.002, 0.05, 0.04, 0.08, 0.4)
    crack = highpass(noise(n), 800) * env_adsr(n, 0.001, 0.02, 0.01, 0.05, 0.2)
    body = soft_saw(np.arange(n) / SR, 90) * env_adsr(n, 0.005, 0.06, 0.04, 0.07, 0.35)
    # pitch drop
    freq = np.linspace(160, 55, n)
    phase = 2 * np.pi * np.cumsum(freq / SR)
    drop = np.sin(phase) * env_adsr(n, 0.002, 0.05, 0.05, 0.07, 0.4)
    return normalize(boom * 0.85 + crack * 0.35 + body * 0.25 + drop * 0.4)


def gen_shot_frost() -> np.ndarray:
    dur = 0.12
    n = int(SR * dur)
    t = np.arange(n) / SR
    shimmer = soft_square(t, np.linspace(980, 1400, n), 0.55) * 0.4
    air = highpass(noise(n, "pink"), 2500) * env_adsr(n, 0.005, 0.03, 0.04, 0.05, 0.35)
    chill = np.sin(2 * np.pi * 720 * t) * 0.25
    return normalize((shimmer + air + chill) * env_adsr(n, 0.008, 0.03, 0.04, 0.05, 0.45))


def gen_hit() -> np.ndarray:
    dur = 0.1
    n = int(SR * dur)
    thud = lowpass(noise(n, "brown"), 400) * env_adsr(n, 0.001, 0.02, 0.02, 0.05, 0.3)
    tick = soft_square(np.arange(n) / SR, np.linspace(400, 180, n), 0.45) * env_adsr(
        n, 0.001, 0.025, 0.01, 0.05, 0.25
    )
    return normalize(thud * 0.8 + tick * 0.45)


def gen_die() -> np.ndarray:
    dur = 0.18
    n = int(SR * dur)
    freq = np.linspace(280, 70, n)
    phase = 2 * np.pi * np.cumsum(freq / SR)
    fall = np.tanh(np.sin(phase) * 1.6)
    dust = lowpass(noise(n, "brown"), 500) * env_adsr(n, 0.01, 0.05, 0.05, 0.07, 0.4)
    return normalize((fall * 0.65 + dust * 0.5) * env_adsr(n, 0.005, 0.05, 0.06, 0.06, 0.5))


def gen_coin() -> np.ndarray:
    dur = 0.15
    n = int(SR * dur)
    t = np.arange(n) / SR
    a = np.sin(2 * np.pi * 880 * t) * env_adsr(n, 0.002, 0.03, 0.02, 0.04, 0.35)
    b = np.sin(2 * np.pi * 1320 * t) * env_adsr(n, 0.04, 0.03, 0.03, 0.05, 0.3)
    sparkle = highpass(noise(n), 4000) * env_adsr(n, 0.001, 0.02, 0.02, 0.05, 0.15) * 0.2
    return normalize(a * 0.55 + b * 0.5 + sparkle)


def gen_gate() -> np.ndarray:
    dur = 0.22
    n = int(SR * dur)
    boom = lowpass(noise(n, "brown"), 120) * env_adsr(n, 0.005, 0.06, 0.08, 0.08, 0.45)
    wood = soft_saw(np.arange(n) / SR, 70) * env_adsr(n, 0.01, 0.07, 0.07, 0.07, 0.4)
    crack = highpass(noise(n), 600) * env_adsr(n, 0.002, 0.04, 0.05, 0.1, 0.25)
    return normalize(boom * 0.9 + wood * 0.35 + crack * 0.3)


def gen_start() -> np.ndarray:
    dur = 0.2
    n = int(SR * dur)
    t = np.arange(n) / SR
    n1 = soft_square(t, 330, 0.35) * env_adsr(n, 0.005, 0.04, 0.04, 0.05, 0.4)
    n2 = soft_square(t, 494, 0.35) * env_adsr(n, 0.06, 0.04, 0.05, 0.05, 0.4)
    return normalize(n1 * 0.55 + n2 * 0.55)


def gen_complete() -> np.ndarray:
    dur = 1.5
    n = int(SR * dur)
    t = np.arange(n) / SR
    notes = [392, 523, 659, 784]
    out = np.zeros(n)
    starts = [0.0, 0.22, 0.44, 0.7]
    for freq, st in zip(notes, starts):
        i0 = int(st * SR)
        length = int(0.55 * SR)
        i1 = min(n, i0 + length)
        seg_n = i1 - i0
        tt = np.arange(seg_n) / SR
        tone = soft_square(tt, freq, 0.4) * 0.45
        harm = np.sin(2 * np.pi * freq * 2 * tt) * 0.12
        e = env_adsr(seg_n, 0.02, 0.08, 0.25, 0.18, 0.55)
        out[i0:i1] += (tone + harm) * e
    sparkle = highpass(noise(n, "pink"), 3000) * env_adsr(n, 0.1, 0.3, 0.5, 0.5, 0.2) * 0.08
    return normalize(out + sparkle, peak=0.8)


def gen_fail() -> np.ndarray:
    dur = 0.75
    n = int(SR * dur)
    freqs = [196, 165, 131]
    starts = [0.0, 0.2, 0.4]
    out = np.zeros(n)
    for freq, st in zip(freqs, starts):
        i0 = int(st * SR)
        length = int(0.4 * SR)
        i1 = min(n, i0 + length)
        seg_n = i1 - i0
        tt = np.arange(seg_n) / SR
        drop = freq * np.linspace(1.0, 0.85, seg_n)
        phase = 2 * np.pi * np.cumsum(drop / SR)
        tone = np.tanh(np.sin(phase) * 1.8)
        e = env_adsr(seg_n, 0.02, 0.08, 0.15, 0.12, 0.5)
        out[i0:i1] += tone * e * 0.55
    rumble = lowpass(noise(n, "brown"), 100) * env_adsr(n, 0.05, 0.2, 0.3, 0.2, 0.4) * 0.35
    return normalize(out + rumble, peak=0.8)


def _note(freq: float, dur: float, soft: float = 0.45, vol: float = 0.35) -> np.ndarray:
    n = int(SR * dur)
    t = np.arange(n) / SR
    tone = soft_square(t, freq, soft) * vol
    harm = np.sin(2 * np.pi * freq * 1.5 * t) * vol * 0.15
    e = env_adsr(n, 0.01, 0.05, max(0.0, dur - 0.12), 0.06, 0.55)
    return (tone + harm) * e


def _drum(dur: float = 0.12, tone_f: float = 90.0) -> np.ndarray:
    n = int(SR * dur)
    body = lowpass(noise(n, "brown"), 200) * env_adsr(n, 0.002, 0.03, 0.02, 0.06, 0.3)
    freq = np.linspace(tone_f * 1.4, tone_f * 0.6, n)
    phase = 2 * np.pi * np.cumsum(freq / SR)
    thump = np.sin(phase) * env_adsr(n, 0.001, 0.04, 0.02, 0.05, 0.35)
    return normalize(body * 0.7 + thump * 0.5, peak=0.6)


def gen_bgm_menu() -> np.ndarray:
    """~6s soft martial/folk pulse loop."""
    bpm = 90
    beat = 60.0 / bpm
    bars = 4
    beats_per_bar = 4
    total = bars * beats_per_bar * beat
    n = int(SR * total)
    out = np.zeros(n)
    # melody motif (pentatonic-ish)
    melody = [196, 247, 294, 247, 220, 196, 165, 196]
    for i, f in enumerate(melody * 2):
        st = int(i * beat * 0.5 * SR)
        note = _note(f, beat * 0.45, soft=0.5, vol=0.22)
        end = min(n, st + len(note))
        out[st:end] += note[: end - st]
    # soft percussion on beats
    for i in range(bars * beats_per_bar):
        st = int(i * beat * SR)
        d = _drum(0.1, 80 if i % 4 == 0 else 110) * (0.55 if i % 4 == 0 else 0.28)
        end = min(n, st + len(d))
        out[st:end] += d[: end - st]
    # light pad drone
    t = np.arange(n) / SR
    pad = (np.sin(2 * np.pi * 98 * t) * 0.06 + np.sin(2 * np.pi * 147 * t) * 0.04) * env_adsr(
        n, 0.4, 0.2, total - 1.0, 0.4, 0.8
    )
    out += pad
    # crossfade ends for seamless-ish loop
    fade = int(0.08 * SR)
    ramp = np.linspace(0, 1, fade)
    out[:fade] *= ramp
    out[-fade:] *= ramp[::-1]
    # blend end into start slightly
    out[:fade] += out[-fade:][::-1] * 0  # keep simple fade
    return normalize(out, peak=0.55)


def gen_bgm_play() -> np.ndarray:
    """~5.5s play groove ~115 BPM."""
    bpm = 115
    beat = 60.0 / bpm
    bars = 4
    total = bars * 4 * beat
    n = int(SR * total)
    out = np.zeros(n)
    melody = [262, 330, 392, 330, 294, 392, 349, 330]
    for i, f in enumerate(melody * 2):
        st = int(i * beat * 0.5 * SR)
        note = _note(f, beat * 0.38, soft=0.42, vol=0.2)
        end = min(n, st + len(note))
        out[st:end] += note[: end - st]
    for i in range(bars * 4):
        st = int(i * beat * SR)
        d = _drum(0.09, 95 if i % 2 == 0 else 130) * (0.5 if i % 4 == 0 else 0.25)
        end = min(n, st + len(d))
        out[st:end] += d[: end - st]
        # offbeat tick
        if i % 2 == 1:
            tick_n = int(0.04 * SR)
            tick = highpass(noise(tick_n), 2000) * env_adsr(tick_n, 0.001, 0.01, 0.01, 0.02, 0.2) * 0.15
            te = min(n, st + tick_n)
            out[st:te] += tick[: te - st]
    t = np.arange(n) / SR
    bass = soft_square(t, 110, 0.6) * 0.08
    # gate bass to beats
    gate = np.zeros(n)
    for i in range(bars * 4):
        st = int(i * beat * SR)
        gn = int(beat * 0.35 * SR)
        gate[st : min(n, st + gn)] = 1.0
    out += bass * gate * env_adsr(n, 0.2, 0.1, total - 0.6, 0.3, 0.85)
    fade = int(0.08 * SR)
    ramp = np.linspace(0, 1, fade)
    out[:fade] *= ramp
    out[-fade:] *= ramp[::-1]
    return normalize(out, peak=0.55)


CLIPS = {
    "click": gen_click,
    "confirm": gen_confirm,
    "error": gen_error,
    "place": gen_place,
    "shot_arrow": gen_shot_arrow,
    "shot_cannon": gen_shot_cannon,
    "shot_frost": gen_shot_frost,
    "hit": gen_hit,
    "die": gen_die,
    "coin": gen_coin,
    "gate": gen_gate,
    "start": gen_start,
    "complete": gen_complete,
    "fail": gen_fail,
    "bgm_menu": gen_bgm_menu,
    "bgm_play": gen_bgm_play,
}


def main() -> int:
    TMP.mkdir(parents=True, exist_ok=True)
    for stem, fn in CLIPS.items():
        print(f"  generating {stem}…")
        samples = fn()
        wav = TMP / f"{stem}.wav"
        write_wav(wav, samples)
        encode(wav, stem)
        print(f"    → ogg+m4a ({len(samples)/SR:.3f}s)")
    shutil.rmtree(TMP, ignore_errors=True)
    print(f"Done. Wrote {len(CLIPS)} clips × 2 formats to:")
    for d in OUT_DIRS:
        print(f"  {d}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
