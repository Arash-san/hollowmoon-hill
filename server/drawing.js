// A photo of a pumpkin face drawn on paper (or painted on a real pumpkin) -> a carving mask: the dark strokes
// become the glowing cut-outs, everything else is transparent, trimmed to a round pumpkin face. The photo is not kept.
import sharp from 'sharp';

const SIZE = 256;

export async function drawingToCarving(photo) {
  // square crop of the middle, flattened to grey and stretched to full contrast
  const { data } = await sharp(photo).rotate().resize(SIZE, SIZE, { fit: 'cover' }).greyscale().normalise().blur(0.6).raw().toBuffer({ resolveWithObject: true });
  // adaptive threshold: a stroke is clearly darker than its neighbourhood (works under uneven room light)
  const mean = new Float32Array(SIZE * SIZE);
  const R = 14;
  const integral = new Float64Array((SIZE + 1) * (SIZE + 1));
  for (let y = 0; y < SIZE; y++) {
    let row = 0;
    for (let x = 0; x < SIZE; x++) {
      row += data[y * SIZE + x];
      integral[(y + 1) * (SIZE + 1) + x + 1] = integral[y * (SIZE + 1) + x + 1] + row;
    }
  }
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const x0 = Math.max(0, x - R), x1 = Math.min(SIZE, x + R + 1), y0 = Math.max(0, y - R), y1 = Math.min(SIZE, y + R + 1);
      const sum = integral[y1 * (SIZE + 1) + x1] - integral[y0 * (SIZE + 1) + x1] - integral[y1 * (SIZE + 1) + x0] + integral[y0 * (SIZE + 1) + x0];
      mean[y * SIZE + x] = sum / ((x1 - x0) * (y1 - y0));
    }
  const out = Buffer.alloc(SIZE * SIZE * 4);
  const c = SIZE / 2, rad = SIZE / 2 - 10;
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      const dark = mean[i] - data[i];
      const inFace = (x - c) ** 2 + (y - c) ** 2 < rad * rad;
      const a = inFace && dark > 22 && data[i] < 170 ? Math.min(255, (dark - 22) * 9) : 0;
      out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = 255;
      out[i * 4 + 3] = a;
    }
  // thicken thin pen lines a little so they read as carved
  return sharp(out, { raw: { width: SIZE, height: SIZE, channels: 4 } }).blur(1.2).png().toBuffer();
}
