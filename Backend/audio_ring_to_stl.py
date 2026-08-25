"""
audio_ring_to_stl.py

Standalone (no bpy required) recreation of the Blender geometry-nodes rig shown in
sound-driver-test-2.blend. Given a .wav file, writes a binary .STL of a corrugated
ring whose radius is driven by the audio's amplitude.

Usage:
    python audio_ring_to_stl.py <input.wav> <output.stl>

Requirements: numpy, scipy
"""

import argparse
import struct

import numpy as np
from scipy.io import wavfile

# # --------------------------------------------------------------------------- #
# # Parameters copied 1:1 from the node trees (step-1.txt / step-2.txt / step-5.txt)
# # --------------------------------------------------------------------------- #

PROFILE_LENGTH = 0.2200000137090683      # Step-1 Mesh Line: End Location.Y
N_PROFILE_DEFAULT = 2000                 # Step-1 Mesh Line: Count

FREQ_LOW = 200.0                         # Sample Sound Frequencies: Low
FREQ_HIGH = 1000.0                       # Sample Sound Frequencies: High
FFT_SIZE = 4096                          # Sample Sound Frequencies: FFT Size
# Window Function = 'Hann'

STRENGTH_SCALE = 0.01                    # Value.005 (1.0) * 0.01   -> feeds Math.001
STRENGTH_OFFSET = 0.003                  # Value.004 (3.0) * 0.001  -> feeds Math.009
STRENGTH_MIN, STRENGTH_MAX = 0.0, 1.0    # Clamp.001 (MINMAX)

# # Float Curve.003 control points ("silence beginning/ending of sound")
ENVELOPE_POINTS = [
    (0.0, 0.0),
    (0.009999999776482582, 1.0),
    (0.9599999785423279, 1.0),
    (0.9961000084877014, 0.0),
]

TUBE_SIDES_DEFAULT = 48                  # Screw modifier: Steps Viewport/Render
# 
# 
# # --------------------------------------------------------------------------- #
# # Audio loading
# # --------------------------------------------------------------------------- #

def load_audio(path):
    """Load a WAV file and return (sample_rate, samples[N, channels]) as floats in ~[-1, 1]."""
    sr, raw = wavfile.read(path)

    if raw.dtype.kind == "i":  # signed integer PCM
        max_val = np.iinfo(raw.dtype).max
        data = raw.astype(np.float64) / max_val
    elif raw.dtype.kind == "u":  # unsigned integer PCM (8-bit wav)
        info = np.iinfo(raw.dtype)
        half = (info.max + 1) / 2.0
        data = (raw.astype(np.float64) - half) / half
    else:  # already float32/float64
        data = raw.astype(np.float64)

    if data.ndim == 1:
        data = data[:, None]

    return sr, data


def sample_band_amplitude(data, sr, times, fft_size, low, high):
#     """
#     For each time in `times` (seconds), take a Hann-windowed FFT centered at that
#     time and return the mean magnitude of bins within [low, high] Hz, averaged
#     across all channels (mirrors "All Channels" = True in Sample Sound Frequencies).
#     """
    n_samples, n_channels = data.shape
    window = np.hanning(fft_size)
    freqs = np.fft.rfftfreq(fft_size, d=1.0 / sr)
    band_mask = (freqs >= low) & (freqs <= high)

    out = np.empty(len(times), dtype=np.float64)
    for i, t in enumerate(times):
        center = int(round(t * sr))
        start = center - fft_size // 2
        end = start + fft_size

        seg = np.zeros((fft_size, n_channels), dtype=np.float64)
        src_start, src_end = max(start, 0), min(end, n_samples)
        if src_end > src_start:
            dst_start = src_start - start
            seg[dst_start:dst_start + (src_end - src_start)] = data[src_start:src_end]

        windowed = seg * window[:, None]
        spectrum = np.fft.rfft(windowed, axis=0)
        mag = np.abs(spectrum) / (fft_size / 2.0)

        if not np.any(band_mask):
            out[i] = 0.0
        else:
            out[i] = float(np.mean(mag[band_mask, :]))

    return out
# 
# 
# # --------------------------------------------------------------------------- #
# # Envelope curve (Float Curve.003 approximation using smoothstep segments)
# # --------------------------------------------------------------------------- #
# 
def _smoothstep(edge0, edge1, x):
    t = np.clip((x - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def envelope(t_norm, points=ENVELOPE_POINTS):
    t_norm = np.clip(t_norm, points[0][0], points[-1][0])
    out = np.zeros_like(t_norm)
    for (x0, y0), (x1, y1) in zip(points[:-1], points[1:]):
        mask = (t_norm >= x0) & (t_norm <= x1)
        if x1 > x0:
            local = _smoothstep(x0, x1, t_norm[mask])
            out[mask] = y0 + (y1 - y0) * local
    return out


# # --------------------------------------------------------------------------- #
# # Mesh construction
# # --------------------------------------------------------------------------- #
# 
def compute_strengths(sr, data, sound_length, n_profile, gain):
    """Reproduce Step-2's math graph, returning one strength value per profile point."""
    y = np.linspace(0.0, PROFILE_LENGTH, n_profile)                 # Mesh Line Y positions
    t_sample = (y / PROFILE_LENGTH) * sound_length                  # Map Range.005
    t_norm = t_sample / sound_length                                # Map Range.006 (== y/PROFILE_LENGTH)

    amplitude = sample_band_amplitude(data, sr, t_sample, FFT_SIZE, FREQ_LOW, FREQ_HIGH)
    amplitude *= gain  # user fudge factor; Blender's internal amplitude scale isn't public

    curve_val = envelope(t_norm)                                    # Float Curve.003
    raw = amplitude * curve_val                                     # Math.015
    strength = raw * STRENGTH_SCALE + STRENGTH_OFFSET               # Math.001 -> Math.007
    strength = np.clip(strength, STRENGTH_MIN, STRENGTH_MAX)        # Clamp.001
    return y, strength


def build_ring_mesh(y, strength, ring_radius, tube_sides):
    """
    Screw (revolve profile around its own axis) + Curve (bend straight tube
    around a circle) collapsed into one direct construction:
    each profile point becomes a circular tube cross-section of radius
    strength[i], centered on a circle of radius `ring_radius`.
    """
    n_length = len(y)
    theta = (y / PROFILE_LENGTH) * 2.0 * np.pi          # position around the big ring
    phi = np.linspace(0.0, 2.0 * np.pi, tube_sides, endpoint=False)  # around tube cross-section

    cos_t, sin_t = np.cos(theta), np.sin(theta)         # (n_length,)
    cos_p, sin_p = np.cos(phi), np.sin(phi)             # (tube_sides,)

    center = np.stack([ring_radius * cos_t, ring_radius * sin_t, np.zeros(n_length)], axis=-1)
    radial_dir = np.stack([cos_t, sin_t, np.zeros(n_length)], axis=-1)     # (n_length, 3)
    z_dir = np.array([0.0, 0.0, 1.0])

    # verts[i, j] = center[i] + strength[i]*cos(phi_j)*radial_dir[i] + strength[i]*sin(phi_j)*z_dir
    verts = (
        center[:, None, :]
        + strength[:, None, None] * cos_p[None, :, None] * radial_dir[:, None, :]
        + strength[:, None, None] * sin_p[None, :, None] * z_dir[None, None, :]
    )
    return verts  # shape (n_length, tube_sides, 3)


def mesh_to_triangles(verts):
    """Turn the (n_length, tube_sides, 3) vertex grid into a flat triangle soup."""
    n_length, tube_sides, _ = verts.shape
    tris = []
    for i in range(n_length - 1):  # last ring duplicates the first (full 0..2pi sweep)
        v0 = verts[i]
        v1 = verts[i + 1]
        for j in range(tube_sides):
            jn = (j + 1) % tube_sides
            a, b = v0[j], v0[jn]
            c, d = v1[jn], v1[j]
            tris.append((a, b, c))
            tris.append((a, c, d))
    return np.array(tris, dtype=np.float64)  # (n_tris, 3, 3)


# # --------------------------------------------------------------------------- #
# # Binary STL writer (no external mesh library needed)
# # --------------------------------------------------------------------------- #
# 
def write_binary_stl(path, triangles):
    normals = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
    lengths = np.linalg.norm(normals, axis=1)
    lengths[lengths == 0] = 1.0
    normals = normals / lengths[:, None]

    with open(path, "wb") as f:
        f.write(struct.pack("<80s", b"audio-driven ring (generated)"))
        f.write(struct.pack("<I", len(triangles)))
        for n, tri in zip(normals, triangles):
            f.write(struct.pack("<3f", *n))
            for v in tri:
                f.write(struct.pack("<3f", *v))
            f.write(struct.pack("<H", 0))


# # --------------------------------------------------------------------------- #
# # CLI
# # --------------------------------------------------------------------------- #
# 
def main():
    ap = argparse.ArgumentParser(description="Turn a WAV file into a corrugated ring STL.")
    ap.add_argument("wav_path", help="Input .wav file")
    ap.add_argument("stl_path", help="Output .stl file")
    ap.add_argument("--n-profile", type=int, default=N_PROFILE_DEFAULT,
                     help=f"Points along the audio profile (default {N_PROFILE_DEFAULT})")
    ap.add_argument("--tube-sides", type=int, default=TUBE_SIDES_DEFAULT,
                     help=f"Cross-section resolution of the tube (default {TUBE_SIDES_DEFAULT}, "
                          f"matches the Screw modifier's Steps)")
    ap.add_argument("--ring-radius", type=float, default=None,
                     help="Big radius of the ring. Default: PROFILE_LENGTH / (2*pi) so the "
                          "audio track maps exactly once around the ring's circumference.")
    ap.add_argument("--sound-length", type=float, default=None,
                     help="Duration (s) used to map profile position -> playback time. "
                          "Default: actual duration of the wav file (the node graph hard-codes "
                          "10.0s to match its specific sample).")
    ap.add_argument("--gain", type=float, default=50.0,
                     help="Extra multiplier on the sampled amplitude before it's scaled/clamped, "
                          "since Blender's internal amplitude normalization isn't public; use this "
                          "to match the amount of corrugation you see in Blender.")
    args = ap.parse_args()

    sr, data = load_audio(args.wav_path)
    sound_length = args.sound_length if args.sound_length is not None else data.shape[0] / sr
    ring_radius = args.ring_radius if args.ring_radius is not None else PROFILE_LENGTH / (2 * np.pi)

    y, strength = compute_strengths(sr, data, sound_length, args.n_profile, args.gain)
    verts = build_ring_mesh(y, strength, ring_radius, args.tube_sides)
    tris = mesh_to_triangles(verts)
    write_binary_stl(args.stl_path, tris)

    print(f"Wrote {args.stl_path}: {len(tris)} triangles "
          f"(profile points={args.n_profile}, tube sides={args.tube_sides}, "
          f"ring radius={ring_radius:.5f}, sound length={sound_length:.3f}s)")


if __name__ == "__main__":
    main()