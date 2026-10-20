#!/usr/bin/env python3
"""Flat home-screen icons. No third-party art."""
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "public"


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def png(size: int) -> bytes:
    raw = bytearray()
    radius = int(size * 0.22)
    for y in range(size):
        raw.append(0)
        for x in range(size):
            inside = rounded(x, y, size, radius)
            if not inside:
                raw.extend((0, 0, 0, 0))
                continue
            # Pine field with a white card and a short bar, like a step card.
            card = size * 0.22 < x < size * 0.78 and size * 0.28 < y < size * 0.72
            bar = size * 0.32 < x < size * 0.68 and size * 0.42 < y < size * 0.50
            if bar:
                raw.extend((20, 83, 45, 255))
            elif card:
                raw.extend((255, 253, 248, 255))
            else:
                raw.extend((20, 83, 45, 255))
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")


def rounded(x: int, y: int, size: int, radius: int) -> bool:
    if x < 0 or y < 0 or x >= size or y >= size:
        return False
    dx = 0
    dy = 0
    if x < radius:
        dx = radius - x
    elif x >= size - radius:
        dx = x - (size - radius - 1)
    if y < radius:
        dy = radius - y
    elif y >= size - radius:
        dy = y - (size - radius - 1)
    return dx * dx + dy * dy <= radius * radius


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "icon-192.png").write_bytes(png(192))
    (OUT / "icon-512.png").write_bytes(png(512))
    (OUT / "apple-touch-icon.png").write_bytes(png(180))
    (OUT / "favicon.svg").write_text(
        """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#14532D"/>
  <rect x="7" y="9" width="18" height="14" rx="3" fill="#FFFDF8"/>
  <rect x="10" y="13" width="12" height="2.5" rx="1" fill="#14532D"/>
</svg>
"""
    )
    print("icons ok")


if __name__ == "__main__":
    main()
