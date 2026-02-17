import sharp from "sharp";
import { mkdirSync } from "fs";
import { join } from "path";

const OUT = join(import.meta.dirname, "..", "public");
mkdirSync(OUT, { recursive: true });

// Brand colors (dark theme — looks best on social cards)
const BG = "#191919";
const FG = "#ededed";
const MUTED = "#777777";
const BORDER = "#2a2a2a";

// Subtle grid pattern for the background — represents "metadata fields"
function gridLines(
  w: number,
  h: number,
  cellSize: number,
  stroke: string
): string {
  const lines: string[] = [];
  for (let x = cellSize; x < w; x += cellSize) {
    lines.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${stroke}" stroke-width="1"/>`
    );
  }
  for (let y = cellSize; y < h; y += cellSize) {
    lines.push(
      `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${stroke}" stroke-width="1"/>`
    );
  }
  return lines.join("\n");
}

// Small abstract "data extraction" icon — a square with lines being pulled out
function icon(x: number, y: number, size: number, color: string): string {
  const s = size;
  const half = s / 2;
  const q = s / 4;
  return `
    <g transform="translate(${x}, ${y})">
      <!-- source square -->
      <rect x="0" y="${q}" width="${half}" height="${half}" fill="none" stroke="${color}" stroke-width="2"/>
      <!-- extraction lines -->
      <line x1="${half + 4}" y1="${q + 4}" x2="${s}" y2="${q + 4}" stroke="${color}" stroke-width="2"/>
      <line x1="${half + 4}" y1="${half}" x2="${s - q / 2}" y2="${half}" stroke="${color}" stroke-width="2" opacity="0.6"/>
      <line x1="${half + 4}" y1="${half + q - 4}" x2="${s}" y2="${half + q - 4}" stroke="${color}" stroke-width="2" opacity="0.3"/>
      <!-- arrow -->
      <polyline points="${half - 2},${half} ${half + 6},${half} ${half + 3},${half - 3}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.5"/>
    </g>
  `;
}

// ── OG Image (1200×630) ──────────────────────────────────────────────
function ogSvg(w: number, h: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${BG}"/>

  <!-- Subtle grid (fades out) -->
  <g opacity="0.08">
    ${gridLines(w, h, 60, FG)}
  </g>

  <!-- Gradient fade over grid edges -->
  <defs>
    <linearGradient id="fadeL" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${BG}"/>
      <stop offset="1" stop-color="${BG}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="fadeR" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${BG}" stop-opacity="0"/>
      <stop offset="1" stop-color="${BG}"/>
    </linearGradient>
    <linearGradient id="fadeT" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BG}"/>
      <stop offset="1" stop-color="${BG}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="fadeB" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BG}" stop-opacity="0"/>
      <stop offset="1" stop-color="${BG}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="180" height="${h}" fill="url(#fadeL)"/>
  <rect x="${w - 180}" y="0" width="180" height="${h}" fill="url(#fadeR)"/>
  <rect x="0" y="0" width="${w}" height="120" fill="url(#fadeT)"/>
  <rect x="0" y="${h - 120}" width="${w}" height="120" fill="url(#fadeB)"/>

  <!-- Icon -->
  ${icon(w / 2 - 24, h / 2 - 100, 48, MUTED)}

  <!-- Title -->
  <text x="${w / 2}" y="${h / 2 + 10}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="48" font-weight="300" letter-spacing="-1" fill="${FG}">
    Metadata Playground
  </text>

  <!-- Subtitle -->
  <text x="${w / 2}" y="${h / 2 + 50}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="16" fill="${MUTED}">
    Extract · Compare · Calculate
  </text>

  <!-- Bottom border accent -->
  <rect x="${w / 2 - 40}" y="${h - 3}" width="80" height="3" fill="${MUTED}" opacity="0.3"/>
</svg>`;
}

// ── Favicon (48×48 base, will be resized) ─────────────────────────────
function faviconSvg(): string {
  // Abstract "M" mark built from data-extraction motif:
  // A square with three horizontal lines emerging from it
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <rect width="48" height="48" fill="${BG}"/>

  <!-- Square mark -->
  <rect x="8" y="12" width="20" height="24" fill="none" stroke="${FG}" stroke-width="3"/>

  <!-- Extraction lines -->
  <line x1="32" y1="17" x2="40" y2="17" stroke="${FG}" stroke-width="3" stroke-linecap="square"/>
  <line x1="32" y1="24" x2="38" y2="24" stroke="${FG}" stroke-width="3" stroke-linecap="square" opacity="0.6"/>
  <line x1="32" y1="31" x2="40" y2="31" stroke="${FG}" stroke-width="3" stroke-linecap="square" opacity="0.3"/>
</svg>`;
}

// ── Generate ──────────────────────────────────────────────────────────
async function main() {
  // OG image 1200×630
  const og = Buffer.from(ogSvg(1200, 630));
  await sharp(og).png().toFile(join(OUT, "og.png"));
  console.log("  og.png (1200×630)");

  // Twitter card 1200×600
  const tw = Buffer.from(ogSvg(1200, 600));
  await sharp(tw).png().toFile(join(OUT, "og-twitter.png"));
  console.log("  og-twitter.png (1200×600)");

  // Favicon — generate 48px PNG then convert to ICO-compatible sizes
  const favSvg = Buffer.from(faviconSvg());

  // Generate multi-size PNGs and combine into ICO
  const sizes = [16, 32, 48] as const;
  const pngBuffers = await Promise.all(
    sizes.map((s) => sharp(favSvg).resize(s, s).png().toBuffer())
  );

  // ICO format: header + directory entries + PNG data
  const ico = buildIco(
    pngBuffers.map((buf, i) => ({ size: sizes[i], data: buf }))
  );
  const { writeFileSync } = await import("fs");
  writeFileSync(join(OUT, "favicon.ico"), ico);
  console.log("  favicon.ico (16, 32, 48)");

  console.log("\nDone.");
}

function buildIco(
  images: { size: number; data: Buffer }[]
): Buffer {
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * images.length;
  let dataOffset = headerSize + dirSize;

  // Header: reserved(2) + type(2) + count(2)
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = ICO
  header.writeUInt16LE(images.length, 4);

  const dirEntries: Buffer[] = [];
  const dataChunks: Buffer[] = [];

  for (const img of images) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(img.size < 256 ? img.size : 0, 0); // width
    entry.writeUInt8(img.size < 256 ? img.size : 0, 1); // height
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(img.data.length, 8); // data size
    entry.writeUInt32LE(dataOffset, 12); // data offset

    dirEntries.push(entry);
    dataChunks.push(img.data);
    dataOffset += img.data.length;
  }

  return Buffer.concat([header, ...dirEntries, ...dataChunks]);
}

main().catch(console.error);
