import sharp from "sharp";

/** Deterministic test image: gradient background plus a few rectangles, PNG. */
export async function testImage(width = 1280, height = 800, variant = 0): Promise<Buffer> {
  const rects = Array.from({ length: 6 }, (_, i) => {
    const x = ((i * 197 + variant * 37) % (width - 200)) | 0;
    const y = ((i * 131 + variant * 53) % (height - 120)) | 0;
    const hue = (i * 60 + variant * 25) % 360;
    return `<rect x="${x}" y="${y}" width="200" height="120" fill="hsl(${hue} 70% 50%)"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#333"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>${rects}
    <text x="40" y="60" font-size="36" font-family="sans-serif">Listing ${variant}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
