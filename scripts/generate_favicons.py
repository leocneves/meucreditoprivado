import os
from PIL import Image, ImageDraw, ImageFont

def generate_brand_icon():
    size = 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Background Rounded Rectangle
    # Gradient from Deep Blue (#1e3a8a) to Vibrant Blue (#2563eb)
    # Draw vertical or diagonal gradient
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    for y in range(size):
        ratio = y / size
        # #1e3a8a (30, 58, 138) -> #0284c7 (2, 132, 199)
        r = int(30 + (2 - 30) * ratio)
        g = int(58 + (132 - 58) * ratio)
        b = int(138 + (199 - 138) * ratio)
        bg_draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    # Mask for rounded corners (radius 112)
    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([(0, 0), (size, size)], radius=112, fill=255)

    img.paste(bg, (0, 0), mask)
    draw = ImageDraw.Draw(img)

    # 2. Grid lines
    draw.line([(80, 360), (432, 360)], fill=(255, 255, 255, 45), width=3)
    draw.line([(80, 260), (432, 260)], fill=(255, 255, 255, 45), width=3)

    # 3. Growth Bars
    # Bar 1
    draw.rounded_rectangle([(110, 270), (156, 360)], radius=8, fill=(255, 255, 255, 75))
    # Bar 2
    draw.rounded_rectangle([(180, 210), (226, 360)], radius=8, fill=(255, 255, 255, 110))
    # Bar 3
    draw.rounded_rectangle([(250, 150), (296, 360)], radius=8, fill=(56, 189, 248, 220))
    # Bar 4
    draw.rounded_rectangle([(320, 100), (366, 360)], radius=8, fill=(16, 185, 129, 255))

    # 4. Trend line
    # Simple line from bar 1 to peak of bar 4
    points = [
        (133, 260), (160, 240), (203, 200), (250, 150), (273, 140), (343, 95)
    ]
    for i in range(len(points) - 1):
        draw.line([points[i], points[i+1]], fill=(255, 255, 255, 230), width=12)
    # Peak dot
    draw.ellipse([(331, 83), (355, 107)], fill=(52, 211, 153, 255), outline=(255, 255, 255, 255), width=5)

    # 5. Bold Typography FIXDATA
    # Try finding system font or fall back to default
    font_path = None
    potential_fonts = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf"
    ]
    for p in potential_fonts:
        if os.path.exists(p):
            font_path = p
            break

    if font_path:
        font = ImageFont.truetype(font_path, 68)
        # FIX in white
        fix_bbox = draw.textbbox((0, 0), "FIX", font=font)
        data_bbox = draw.textbbox((0, 0), "DATA", font=font)
        fix_w = fix_bbox[2] - fix_bbox[0]
        data_w = data_bbox[2] - data_bbox[0]
        total_w = fix_w + data_w + 4

        start_x = (size - total_w) // 2
        y_pos = 385

        draw.text((start_x, y_pos), "FIX", font=font, fill=(255, 255, 255, 255))
        draw.text((start_x + fix_w + 4, y_pos), "DATA", font=font, fill=(186, 230, 253, 255))
    else:
        # Fallback text
        draw.text((120, 390), "FIXDATA", fill=(255, 255, 255, 255))

    return img

def main():
    print("Gerando favicons e logos em múltiplos formatos para SEO...")
    img = generate_brand_icon()

    # Targets
    target_dirs = [
        "/home/home/Documents/fixdata/public",
        "/home/home/Documents/fixdata/docs"
    ]

    sizes = {
        "favicon-48x48.png": 48,
        "favicon-96x96.png": 96,
        "favicon-192x192.png": 192,
        "apple-touch-icon.png": 180,
        "icon-512x512.png": 512
    }

    for d in target_dirs:
        if not os.path.exists(d):
            continue
        # Save PNG sizes
        for fname, s in sizes.items():
            resized = img.resize((s, s), Image.Resampling.LANCZOS)
            out_path = os.path.join(d, fname)
            resized.save(out_path, "PNG")
            print(f"Salvo: {out_path} ({s}x{s})")

        # Save multi-size favicon.ico (16, 32, 48)
        ico_path = os.path.join(d, "favicon.ico")
        img.save(
            ico_path,
            format="ICO",
            sizes=[(16, 16), (32, 32), (48, 48)]
        )
        print(f"Salvo: {ico_path} (Multi-res 16, 32, 48)")

    # Copiar também favicon.svg para docs
    svg_pub = "/home/home/Documents/fixdata/public/favicon.svg"
    svg_docs = "/home/home/Documents/fixdata/docs/favicon.svg"
    if os.path.exists(svg_pub):
        with open(svg_pub, "r") as src, open(svg_docs, "w") as dst:
            dst.write(src.read())
        print(f"Copiado: {svg_docs}")

if __name__ == "__main__":
    main()
