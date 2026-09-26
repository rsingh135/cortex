/** Deterministic placeholder photo as an inline SVG data URL. No network fetches. */
import { hash32 } from "./replies";

export function placeholderPhoto(id: string, index = 0, w = 640, h = 420): string {
  const h1 = hash32(`${id}:${index}`);
  const hue = h1 % 360;
  const hue2 = (hue + 40) % 360;
  const label = id.replace("listing:", "#");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 45% 82%)"/><stop offset="1" stop-color="hsl(${hue2} 40% 68%)"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<rect x="${w * 0.12}" y="${h * 0.22}" width="${w * 0.3}" height="${h * 0.45}" fill="hsl(${hue} 30% 95% / 0.7)"/>
<rect x="${w * 0.55}" y="${h * 0.3}" width="${w * 0.3}" height="${h * 0.37}" fill="hsl(${hue2} 30% 95% / 0.6)"/>
<text x="${w / 2}" y="${h - 24}" font-family="sans-serif" font-size="20" text-anchor="middle" fill="hsl(${hue} 30% 25%)">${label} · photo ${index + 1}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
