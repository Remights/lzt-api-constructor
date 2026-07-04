"""Generate web/icon.ico from web/icon.svg for PyInstaller."""
from __future__ import annotations

import io
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SVG = ROOT / "web" / "icon.svg"
ICO = ROOT / "web" / "icon.ico"
VIEW = 256.0
FILL = 1.02
SIZES = (256, 128, 64, 48, 32, 24, 16)

_dom = None


def _get_dom():
    global _dom
    if _dom is not None:
        return _dom
    import skia

    data = skia.Data.MakeWithCopy(SVG.read_bytes())
    stream = skia.MemoryStream.Make(data)
    dom = skia.SVGDOM.MakeFromStream(stream)
    if dom is None:
        raise RuntimeError(f"Could not parse {SVG}")
    dom.setContainerSize(skia.Size(int(VIEW), int(VIEW)))
    _dom = dom
    return dom


def _render_svg_size(size: int):
    """Vector render at native size (no raster downscale)."""
    import skia
    from PIL import Image

    dom = _get_dom()
    surface = skia.Surface(size, size)
    scale = (size / VIEW) * FILL
    with surface as canvas:
        canvas.clear(skia.Color4f(0, 0, 0, 0))
        canvas.translate(size / 2, size / 2)
        canvas.scale(scale, scale)
        canvas.translate(-VIEW / 2, -VIEW / 2)
        dom.render(canvas)
    png = bytes(surface.makeImageSnapshot().encodeToData(skia.EncodedImageFormat.kPNG, 100))
    img = Image.open(io.BytesIO(png)).convert("RGBA")
    if sum(1 for p in img.getdata() if p[3] > 0) < 8:
        raise RuntimeError(f"Empty frame at {size}px")
    return img


def _save_ico_png(images: list, path: Path) -> None:
    """ICO with embedded PNG frames (Vista+). Avoids Pillow BMP/AND mask bugs."""
    png_frames: list[tuple[int, bytes]] = []
    for img in images:
        size = img.width
        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=False)
        png_frames.append((size, buf.getvalue()))

    count = len(png_frames)
    header = struct.pack("<HHH", 0, 1, count)
    entries = bytearray()
    blob = bytearray()
    offset = 6 + 16 * count
    for size, png in png_frames:
        w = 0 if size >= 256 else size
        h = 0 if size >= 256 else size
        entries.extend(struct.pack("<BBBBHHII", w, h, 0, 0, 1, 32, len(png), offset))
        blob.extend(png)
        offset += len(png)

    path.write_bytes(header + bytes(entries) + bytes(blob))


def main() -> int:
    if not SVG.is_file():
        print(f"Missing {SVG}", file=sys.stderr)
        return 1

    try:
        images = [_render_svg_size(s) for s in SIZES]
        _save_ico_png(images, ICO)
    except Exception as exc:
        print(f"Failed to render {SVG}: {exc}", file=sys.stderr)
        print("Install deps: pip install -r requirements-dev.txt", file=sys.stderr)
        return 1

    print(f"OK: {ICO} ({ICO.stat().st_size} bytes, {len(SIZES)} PNG frames)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
