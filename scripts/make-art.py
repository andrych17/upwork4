#!/usr/bin/env python3
"""Sample step pictures for the dummy workstation tasks. Not client content."""
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "public" / "samples"
OUT.mkdir(parents=True, exist_ok=True)

TABLE = """
<rect x="70" y="448" width="660" height="26" rx="8" fill="#D7C4A3"/>
<rect x="140" y="474" width="22" height="78" rx="6" fill="#B08968"/>
<rect x="638" y="474" width="22" height="78" rx="6" fill="#B08968"/>
"""

BOX = """
<rect x="300" y="268" width="200" height="160" rx="10" fill="#F0D7A6" stroke="#6B4E2E" stroke-width="8"/>
<path d="M308 280 L400 232 L492 280" fill="#E4EFE6" stroke="#6B4E2E" stroke-width="8" stroke-linejoin="round"/>
"""


def svg(name: str, body: str) -> None:
    doc = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#E4EFE6"/>
  {body}
</svg>
'''
    (OUT / name).write_text(doc)


svg("bench.svg", TABLE + '<rect x="160" y="360" width="480" height="78" rx="16" fill="#FFFDF8" stroke="#143D2E" stroke-width="8"/>')
svg("box.svg", TABLE + BOX)
svg(
    "line.svg",
    TABLE
    + BOX
    + """
<rect x="120" y="330" width="70" height="90" rx="16" fill="#1F7A4D"/>
<rect x="560" y="300" width="78" height="78" rx="39" fill="#1F7A4D"/>
<rect x="650" y="340" width="90" height="56" rx="14" fill="#1F7A4D"/>
""",
)
svg(
    "hold.svg",
    TABLE
    + """
<rect x="330" y="150" width="140" height="120" rx="24" fill="#1F7A4D"/>
""",
)
svg(
    "in-box.svg",
    TABLE
    + BOX
    + '<rect x="345" y="310" width="110" height="80" rx="16" fill="#1F7A4D"/>',
)
svg(
    "fold.svg",
    TABLE
    + """
<rect x="300" y="250" width="200" height="178" rx="10" fill="#F0D7A6" stroke="#6B4E2E" stroke-width="8"/>
<path d="M300 300 L400 250 L500 300" fill="#E8C98A" stroke="#6B4E2E" stroke-width="8" stroke-linejoin="round"/>
""",
)
svg(
    "find.svg",
    TABLE
    + """
<rect x="300" y="250" width="200" height="178" rx="10" fill="#F0D7A6" stroke="#6B4E2E" stroke-width="8"/>
<rect x="345" y="320" width="110" height="70" rx="8" fill="#FFFDF8" stroke="#143D2E" stroke-width="6"/>
""",
)
svg(
    "name.svg",
    """
<rect x="170" y="140" width="460" height="300" rx="24" fill="#FFFDF8" stroke="#143D2E" stroke-width="8"/>
<rect x="230" y="210" width="280" height="28" rx="8" fill="#143D2E"/>
<rect x="230" y="270" width="200" height="22" rx="8" fill="#8AA394"/>
<rect x="230" y="320" width="240" height="22" rx="8" fill="#8AA394"/>
""",
)
svg(
    "press.svg",
    """
<rect x="150" y="250" width="500" height="180" rx="20" fill="#FFFDF8" stroke="#143D2E" stroke-width="8"/>
<circle cx="400" cy="180" r="54" fill="#F0D7A6" stroke="#6B4E2E" stroke-width="8"/>
<rect x="384" y="220" width="32" height="70" rx="12" fill="#F0D7A6" stroke="#6B4E2E" stroke-width="8"/>
""",
)
print(f"wrote {len(list(OUT.glob('*.svg')))} samples")
