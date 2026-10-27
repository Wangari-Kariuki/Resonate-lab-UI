"""
audio_to_stl.py

Turns a WAV file of any length / sample rate / loudness into a closed,
rectangular-prism STL whose top face is displaced by a log-frequency
spectrogram.

Axis mapping (unchanged from the original script)
    time       -> X (long axis)
    frequency  -> Y (short axis, log-spaced)
    amplitude  -> Z (louder = taller, from H_MIN up to H_MIN + relief)

What is different from the original
    * Every constant is a command-line option.
    * Window is defined in milliseconds (not samples), so it behaves the same
      at any sample rate. Hop is derived from a target column count, so mesh
      size stays predictable for any clip length.
    * Time axis: "fit" (clip is stretched to a fixed width) or "fixed"
      (width grows with duration at a constant units-per-second).
    * Frequency range is clamped to Nyquist; sample rates and clips shorter
      than one window are handled.
    * Normalisation: "absolute" (comparable between files), "percentile"
      (robust to silence / spikes) or "relative" (the original min-max).
    * White border is PADDED around the data and faded, instead of
      overwriting the first/last rows and columns of real audio.
    * Mesh construction and STL writing are fully vectorised.
    * 8/16/24/32-bit PCM and float WAVs are supported.

Requirements: numpy, scipy

Examples
    python audio_to_stl.py in.wav out.stl
    python audio_to_stl.py bass.wav out.stl --fmin 30 --fmax 400
    python audio_to_stl.py long.wav out.stl --time-mode fixed --units-per-second 0.022
    python audio_to_stl.py in.wav out.stl --relief-frac 3 --normalize absolute
"""

import argparse
import sys
import wave

import numpy as np
from scipy.io import wavfile
from scipy.signal import stft

# --------------------------------------------------------------------------- #
# Defaults (all overridable from the command line)
# --------------------------------------------------------------------------- #

DEFAULT_WIDTH = 0.2200000137090683   # reference width (long axis)
DEFAULT_ASPECT = 2.0 / 3.0           # length : width
DEFAULT_HMIN_FRAC = 0.03             # H_MIN = width * this
DEFAULT_RELIEF_FRAC = 0.5            # max displacement = H_MIN * this
FULL_SCALE_STFT_MAG = 0.5            # |STFT| of a full-scale sine (scipy 'spectrum' scaling)


# --------------------------------------------------------------------------- #
# Audio loading
# --------------------------------------------------------------------------- #

def _read_pcm24(path):
    """Fallback reader for 24-bit PCM WAVs."""
    with wave.open(path, "rb") as w:
        if w.getsampwidth() != 3:
            raise ValueError("Unsupported WAV format")
        sr, ch = w.getframerate(), w.getnchannels()
        raw = np.frombuffer(w.readframes(w.getnframes()), dtype=np.uint8)
    raw = raw.reshape(-1, 3).astype(np.int32)
    val = raw[:, 0] | (raw[:, 1] << 8) | (raw[:, 2] << 16)
    val = np.where(val & 0x800000, val - (1 << 24), val)
    data = val.astype(np.float64) / float(1 << 23)
    return sr, data.reshape(-1, ch) if ch > 1 else data


def load_audio(path):
    """Return (sample_rate, mono float64 samples roughly in [-1, 1])."""
    try:
        sr, raw = wavfile.read(path)
        if raw.dtype.kind == "i":
            data = raw.astype(np.float64) / float(np.iinfo(raw.dtype).max)
        elif raw.dtype.kind == "u":
            half = (np.iinfo(raw.dtype).max + 1) / 2.0
            data = (raw.astype(np.float64) - half) / half
        else:
            data = raw.astype(np.float64)
    except ValueError:
        sr, data = _read_pcm24(path)

    if data.ndim > 1:
        data = data.mean(axis=1)
    if data.size == 0:
        raise ValueError("Audio file contains no samples")
    return sr, data


# --------------------------------------------------------------------------- #
# Spectrogram
# --------------------------------------------------------------------------- #

def pick_window(sr, window_ms):
    """Nearest power-of-two window length (samples) for the requested duration."""
    n = max(256, int(round(2 ** np.round(np.log2(sr * window_ms / 1000.0)))))
    return n


def log_interp_matrix(f_lin, f_log):
    """Sparse-ish linear interpolation weights: mag_log = M0*(1-w) + M1*w."""
    idx = np.clip(np.searchsorted(f_lin, f_log) - 1, 0, len(f_lin) - 2)
    w = (f_log - f_lin[idx]) / (f_lin[idx + 1] - f_lin[idx])
    return idx, np.clip(w, 0.0, 1.0)


def compute_log_spectrogram(sr, data, window, hop, fmin, fmax, n_bins,
                            normalize, db_floor, pct_lo, pct_hi):
    """
    Returns pixel (n_time, n_bins) in [0, 1]; 0 = black = loudest, 1 = white = quietest.
    """
    # Clips shorter than one window (plus a hop) are zero-padded so >= 2 frames exist.
    min_len = window + hop
    if len(data) < min_len:
        data = np.pad(data, (0, min_len - len(data)))

    f, _, Z = stft(data, fs=sr, window="hann", nperseg=window,
                   noverlap=window - hop, boundary=None, padded=False)
    mag = np.abs(Z)                                   # (n_freq_lin, n_time)

    f_log = np.geomspace(fmin, fmax, n_bins)
    i0, w = log_interp_matrix(f, f_log)
    mag_log = mag[i0] * (1.0 - w)[:, None] + mag[i0 + 1] * w[:, None]

    db = 20.0 * np.log10(mag_log + 1e-12)

    if normalize == "absolute":
        ref_db = 20.0 * np.log10(FULL_SCALE_STFT_MAG)
        lo, hi = db_floor, ref_db                     # e.g. -80 dB .. full scale
    elif normalize == "percentile":
        lo, hi = np.percentile(db, [pct_lo, pct_hi])
    else:                                             # "relative" (original behaviour)
        lo, hi = db.min(), db.max()

    if hi - lo < 1e-9:
        norm_amp = np.zeros_like(db)
    else:
        norm_amp = np.clip((db - lo) / (hi - lo), 0.0, 1.0)

    return (1.0 - norm_amp).T                         # (n_time, n_bins)


# --------------------------------------------------------------------------- #
# White padded border (adds margin instead of overwriting audio)
# --------------------------------------------------------------------------- #

def _smoothstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def _pad_ramp(n_total, pad):
    """0 at both outer ends, rising smoothly to 1 at `pad` cells in, then flat 1."""
    idx = np.arange(n_total, dtype=np.float64)
    return np.minimum(_smoothstep(idx / pad), _smoothstep((n_total - 1 - idx) / pad))


def pad_with_white_border(pixel, pad_t, pad_f):
    """
    Extends the grid by pad_t / pad_f cells on every side by replicating the edge
    values, then fades darkness to exactly 0 at the outer edge. No real audio
    cell is modified in the interior.
    """
    darkness = 1.0 - pixel
    darkness = np.pad(darkness, ((pad_t, pad_t), (pad_f, pad_f)), mode="edge")
    mask = (_pad_ramp(darkness.shape[0], pad_t)[:, None] *
            _pad_ramp(darkness.shape[1], pad_f)[None, :])
    return 1.0 - darkness * mask


# --------------------------------------------------------------------------- #
# Vectorised mesh
# --------------------------------------------------------------------------- #

def _quads(a, b, c, d):
    """Quads (arrays of shape (..., 3)) -> triangles (a,b,c),(a,c,d); shape (N, 3, 3)."""
    a, b, c, d = (np.asarray(v).reshape(-1, 3) for v in (a, b, c, d))
    t = np.empty((a.shape[0], 2, 3, 3), dtype=np.float64)
    t[:, 0, 0], t[:, 0, 1], t[:, 0, 2] = a, b, c
    t[:, 1, 0], t[:, 1, 1], t[:, 1, 2] = a, c, d
    return t.reshape(-1, 3, 3)


def build_prism_mesh(x, y, height):
    """
    x: (n_t,) positions along the long axis, y: (n_f,) along the short axis,
    height: (n_t, n_f) top-surface heights. Returns (n_tris, 3, 3).
    """
    n_t, n_f = height.shape
    top = np.empty((n_t, n_f, 3), dtype=np.float64)
    top[..., 0] = x[:, None]
    top[..., 1] = y[None, :]
    top[..., 2] = height
    bot = top.copy()
    bot[..., 2] = 0.0

    parts = []

    # top (+Z) and bottom (-Z, reversed winding)
    parts.append(_quads(top[:-1, :-1], top[1:, :-1], top[1:, 1:], top[:-1, 1:]))
    parts.append(_quads(bot[:-1, :-1], bot[:-1, 1:], bot[1:, 1:], bot[1:, :-1]))

    # side walls (edges are flat at H_MIN thanks to the faded border).
    # Windings are chosen so every normal points outward.
    parts.append(_quads(bot[0, :-1], top[0, :-1], top[0, 1:], bot[0, 1:]))          # -x
    parts.append(_quads(bot[-1, :-1], bot[-1, 1:], top[-1, 1:], top[-1, :-1]))      # +x
    parts.append(_quads(bot[:-1, 0], bot[1:, 0], top[1:, 0], top[:-1, 0]))          # -y
    parts.append(_quads(bot[:-1, -1], top[:-1, -1], top[1:, -1], bot[1:, -1]))      # +y

    return np.concatenate(parts, axis=0)


# --------------------------------------------------------------------------- #
# Binary STL writer (single tofile call)
# --------------------------------------------------------------------------- #

STL_DTYPE = np.dtype([("n", "<f4", (3,)), ("v", "<f4", (3, 3)), ("attr", "<u2")])


def write_binary_stl(path, tris):
    nrm = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
    ln = np.linalg.norm(nrm, axis=1)
    ln[ln == 0] = 1.0
    nrm /= ln[:, None]

    rec = np.zeros(len(tris), dtype=STL_DTYPE)
    rec["n"] = nrm
    rec["v"] = tris
    with open(path, "wb") as fh:
        fh.write(b"audio spectrogram displaced prism".ljust(80, b" "))
        fh.write(np.uint32(len(tris)).tobytes())
        rec.tofile(fh)


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def parse_args(argv=None):
    ap = argparse.ArgumentParser(description="WAV -> spectrogram-displaced prism STL")
    ap.add_argument("wav_path")
    ap.add_argument("stl_path")

    g = ap.add_argument_group("frequency")
    g.add_argument("--fmin", type=float, default=200.0, help="lowest frequency, Hz (default 200)")
    g.add_argument("--fmax", type=float, default=2000.0,
                   help="highest frequency, Hz (default 2000; clamped to just under Nyquist)")
    g.add_argument("--freq-bins", type=int, default=200, help="log-spaced frequency rows (default 200)")

    g = ap.add_argument_group("time / resolution")
    g.add_argument("--window-ms", type=float, default=186.0,
                   help="STFT window length in ms, rounded to a power of two samples (default 186 "
                        "~ 8192 samples at 44.1 kHz)")
    g.add_argument("--target-cols", type=int, default=400,
                   help="approximate number of time columns; sets the hop (default 400)")
    g.add_argument("--hop", type=int, default=None,
                   help="explicit hop in samples (overrides --target-cols)")

    g = ap.add_argument_group("amplitude")
    g.add_argument("--normalize", choices=["absolute", "percentile", "relative"], default="percentile",
                   help="absolute: fixed dB scale (comparable between files); percentile: robust "
                        "per-file scaling (default); relative: raw per-file min-max (original)")
    g.add_argument("--db-floor", type=float, default=-80.0,
                   help="absolute mode: dB that maps to the lowest height (default -80)")
    g.add_argument("--pct-lo", type=float, default=2.0, help="percentile mode: low clip (default 2)")
    g.add_argument("--pct-hi", type=float, default=99.5, help="percentile mode: high clip (default 99.5)")

    g = ap.add_argument_group("geometry")
    g.add_argument("--time-mode", choices=["fit", "fixed"], default="fit",
                   help="fit: stretch clip to --width; fixed: width = duration * --units-per-second")
    g.add_argument("--width", type=float, default=DEFAULT_WIDTH,
                   help=f"long-axis size in fit mode / reference size for heights (default {DEFAULT_WIDTH})")
    g.add_argument("--units-per-second", type=float, default=None,
                   help="fixed mode: model units per second of audio (default width/10)")
    g.add_argument("--aspect", type=float, default=DEFAULT_ASPECT,
                   help="length:width ratio (default 2/3)")
    g.add_argument("--length", type=float, default=None,
                   help="explicit short-axis size (default width*aspect; in fixed mode the "
                        "reference width*aspect, so the frequency axis keeps a constant size)")
    g.add_argument("--hmin-frac", type=float, default=DEFAULT_HMIN_FRAC,
                   help="base height as a fraction of the reference width (default 0.03)")
    g.add_argument("--relief-frac", type=float, default=DEFAULT_RELIEF_FRAC,
                   help="max displacement as a fraction of base height (default 0.5; try 2-4 for "
                        "more visible relief)")
    g.add_argument("--pad-frac", type=float, default=0.05,
                   help="white border added around the data, as a fraction of each axis (default 0.05)")
    return ap.parse_args(argv)


def main(argv=None):
    a = parse_args(argv)

    sr, data = load_audio(a.wav_path)
    duration = len(data) / sr

    # --- frequency range, clamped to what the sample rate can represent ---
    nyq = sr / 2.0
    fmax = min(a.fmax, 0.98 * nyq)
    if fmax < a.fmax:
        print(f"note: --fmax {a.fmax:g} Hz exceeds Nyquist; using {fmax:g} Hz", file=sys.stderr)
    if not (0 < a.fmin < fmax):
        sys.exit(f"error: need 0 < fmin < fmax (got {a.fmin:g}, {fmax:g})")

    # --- window / hop ---
    window = pick_window(sr, a.window_ms)
    if a.fmin < sr / window:
        print(f"note: fmin {a.fmin:g} Hz is below the window's frequency resolution "
              f"({sr / window:.1f} Hz); low rows will look smeared. Increase --window-ms.",
              file=sys.stderr)
    if a.hop:
        hop = a.hop
    else:
        hop = max(1, (max(len(data), window) - window) // max(a.target_cols - 1, 1))
    hop = min(hop, window)

    pixel = compute_log_spectrogram(sr, data, window, hop, a.fmin, fmax, a.freq_bins,
                                    a.normalize, a.db_floor, a.pct_lo, a.pct_hi)
    n_t, n_f = pixel.shape

    pad_t = max(3, int(round(a.pad_frac * n_t)))
    pad_f = max(3, int(round(a.pad_frac * n_f)))
    pixel = pad_with_white_border(pixel, pad_t, pad_f)
    n_t_tot, n_f_tot = pixel.shape

    # --- geometry ---
    h_min = a.width * a.hmin_frac
    relief = h_min * a.relief_frac
    height = h_min + (1.0 - pixel) * relief

    if a.time_mode == "fit":
        width = a.width
        x = np.linspace(0.0, width, n_t_tot)
    else:
        ups = a.units_per_second if a.units_per_second else a.width / 10.0
        dx = (hop / sr) * ups
        x = np.arange(n_t_tot) * dx
        width = x[-1]
    length = a.length if a.length else a.width * a.aspect
    y = np.linspace(0.0, length, n_f_tot)

    tris = build_prism_mesh(x, y, height)
    write_binary_stl(a.stl_path, tris)

    print(f"Wrote {a.stl_path}: {len(tris):,} triangles")
    print(f"  audio: {duration:.2f} s @ {sr} Hz | window={window} samples ({1000 * window / sr:.0f} ms), hop={hop}")
    print(f"  grid:  {n_t} x {n_f} (+ white border {pad_t}/{pad_f} cells) | "
          f"{fmin_str(a.fmin)}-{fmin_str(fmax)} Hz, normalize={a.normalize}")
    print(f"  prism: width={width:.6f}, length={length:.6f}, "
          f"min height={h_min:.6f}, max height={h_min + relief:.6f}")
    secs_per_unit = (n_t_tot - 1) * hop / sr / width if width else float("nan")
    print(f"  scale: ~{1.0 / secs_per_unit:.5f} model units per second of audio (incl. border)")


def fmin_str(v):
    return f"{v:g}"


if __name__ == "__main__":
    main()