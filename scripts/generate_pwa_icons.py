from pathlib import Path
from PIL import Image, ImageDraw


SIZES = (72, 96, 128, 144, 152, 192, 384, 512)
OUTPUT = Path(__file__).resolve().parents[1] / "client" / "public" / "icons"


def point(size: int, x: float, y: float) -> tuple[int, int]:
    return round(size * x / 512), round(size * y / 512)


def create_icon(size: int) -> None:
    scale = 4
    canvas = size * scale
    image = Image.new("RGB", (canvas, canvas), "#047857")
    draw = ImageDraw.Draw(image)

    # A subtle diagonal brand gradient.
    for y in range(canvas):
        ratio = y / max(canvas - 1, 1)
        color = (
            round(5 * (1 - ratio) + 19 * ratio),
            round(150 * (1 - ratio) + 78 * ratio),
            round(105 * (1 - ratio) + 74 * ratio),
        )
        draw.line((0, y, canvas, y), fill=color)

    width_p = max(5, round(size * 49 / 512)) * scale
    width_pulse = max(4, round(size * 32 / 512)) * scale
    p_path = [point(size, x, y) for x, y in ((154, 386), (154, 132), (271, 132), (397, 132), (397, 236), (397, 339), (271, 339), (228, 339))]
    p_path = [(x * scale, y * scale) for x, y in p_path]
    draw.line(p_path[:3], fill="white", width=width_p, joint="curve")
    draw.arc(
        (point(size, 205, 132)[0] * scale, point(size, 205, 132)[1] * scale,
         point(size, 397, 339)[0] * scale, point(size, 397, 339)[1] * scale),
        start=-90,
        end=90,
        fill="white",
        width=width_p,
    )
    draw.line((point(size, 154, 132)[0] * scale, point(size, 154, 132)[1] * scale,
               point(size, 154, 386)[0] * scale, point(size, 154, 386)[1] * scale), fill="white", width=width_p)

    pulse = [point(size, x, y) for x, y in ((86, 272), (159, 272), (189, 206), (235, 338), (268, 263), (426, 263))]
    draw.line([(x * scale, y * scale) for x, y in pulse], fill="#FCD34D", width=width_pulse, joint="curve")

    image.resize((size, size), Image.Resampling.LANCZOS).save(OUTPUT / f"icon-{size}.png", optimize=True)


if __name__ == "__main__":
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for icon_size in SIZES:
        create_icon(icon_size)
