// Generates PNG icons for PWA using only Node.js built-ins (no canvas/sharp needed)
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(__dirname, '../client/public/icons');

// Create a pixel buffer for the icon
function createIconPixels(size) {
  const pixels = new Uint8Array(size * size * 4);
  const r = Math.round(size * 0.234);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Rounded rect check
      let inRect = false;
      const cx = x, cy = y;
      if (cx >= r && cx <= size - r) inRect = true;
      else if (cy >= r && cy <= size - r) inRect = true;
      else {
        // corner circles
        const corners = [[r, r], [size - r, r], [r, size - r], [size - r, size - r]];
        for (const [ox, oy] of corners) {
          if (Math.sqrt((cx - ox) ** 2 + (cy - oy) ** 2) <= r) { inRect = true; break; }
        }
      }

      if (!inRect) {
        pixels[idx + 3] = 0; // transparent
        continue;
      }

      // Green background
      pixels[idx + 0] = 0x00;   // R
      pixels[idx + 1] = 0x85;   // G
      pixels[idx + 2] = 0x3F;   // B
      pixels[idx + 3] = 0xFF;   // A

      // EKG line: check if pixel is near the polyline
      const pad = size * 0.125;
      const midY = size / 2;
      const lw = size * 0.037; // half line width

      const points = [
        [pad, midY],
        [size * 0.281, midY],
        [size * 0.375, size * 0.25],
        [size * 0.5, size * 0.75],
        [size * 0.625, size * 0.375],
        [size * 0.719, midY],
        [size - pad, midY],
      ];

      let onLine = false;
      for (let i = 0; i < points.length - 1; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[i + 1];
        // Distance from point to segment
        const dx = x2 - x1, dy = y2 - y1;
        const len2 = dx * dx + dy * dy;
        let t = len2 > 0 ? ((cx - x1) * dx + (cy - y1) * dy) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        const nx = x1 + t * dx, ny = y1 + t * dy;
        const dist = Math.sqrt((cx - nx) ** 2 + (cy - ny) ** 2);
        if (dist <= lw + 0.5) { onLine = true; break; }
      }

      if (onLine) {
        pixels[idx + 0] = 0xFF;
        pixels[idx + 1] = 0xFF;
        pixels[idx + 2] = 0xFF;
        pixels[idx + 3] = 0xFF;
      }
    }
  }
  return pixels;
}

// Encode pixels as PNG
function encodePNG(width, height, pixels) {
  function crc32(buf) {
    let c = 0xFFFFFFFF;
    const table = [];
    for (let i = 0; i < 256; i++) {
      let n = i;
      for (let j = 0; j < 8; j++) n = n & 1 ? 0xEDB88320 ^ (n >>> 1) : n >>> 1;
      table[i] = n;
    }
    for (const b of buf) c = table[(c ^ b) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function chunk(type, data) {
    const t = Buffer.from(type);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crcBuf = Buffer.concat([t, data]);
    const crcVal = Buffer.alloc(4); crcVal.writeUInt32BE(crc32(crcBuf));
    return Buffer.concat([len, t, data, crcVal]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Raw scanlines (filter byte 0 before each row)
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * (1 + width * 4) + 1 + x * 4;
      raw[dst] = pixels[src];
      raw[dst+1] = pixels[src+1];
      raw[dst+2] = pixels[src+2];
      raw[dst+3] = pixels[src+3];
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

for (const size of sizes) {
  const pixels = createIconPixels(size);
  const png = encodePNG(size, size, pixels);
  const outPath = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`✓ icon-${size}.png (${png.length} bytes)`);
}

console.log('\nDone! All icons generated.');
