/**
 * Perceptual hash for near-duplicate capture detection.
 * Average hash: resize to 8x8 grayscale (via 32x32 then box-average), threshold at the mean,
 * 64 bits as 16 hex chars. Good enough to skip identical frames; not a similarity search.
 */
import sharp from "sharp";

const SIDE = 8;

export async function phash(image: Buffer): Promise<string> {
  const { data } = await sharp(image)
    .grayscale()
    .resize(SIDE, SIDE, { fit: "fill", kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = Array.from(data.subarray(0, SIDE * SIDE));
  const mean = pixels.reduce((a, b) => a + b, 0) / pixels.length;
  let bits = 0n;
  for (const p of pixels) bits = (bits << 1n) | (p > mean ? 1n : 0n);
  return bits.toString(16).padStart(16, "0");
}

/** Number of differing bits between two 64-bit hex hashes. */
export function hammingDistance(a: string, b: string): number {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}
