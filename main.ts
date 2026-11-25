// main.ts — "Convince the AI Judge to Visit Your House"
// A handwritten-style invitation letter, drawn pixel by pixel as a
// 1024x1024 PNG with only the Node standard library.
// Run: MAKEFUN_OUTPUT_DIR=out node main.ts   (defaults to /output)
// Deterministic: the same code always writes the same bytes.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";

const W = 1024;
const H = 1024;
const buf = new Uint8Array(W * H * 3);

type Colour = [number, number, number];
const WALL: Colour = [96, 112, 86];
const WALL_DARK: Colour = [74, 88, 66];
const CREAM: Colour = [250, 243, 221];
const CREAM_SHADE: Colour = [238, 228, 200];
const INK: Colour = [46, 33, 24];
const RUST: Colour = [168, 74, 44];
const GOLD: Colour = [178, 134, 52];
const LEAF: Colour = [86, 122, 74];
const ROOF: Colour = [146, 58, 44];
const SEAL: Colour = [172, 48, 40];
const SEAL_DARK: Colour = [128, 32, 28];
const WHITE: Colour = [255, 252, 244];
const SKY: Colour = [214, 228, 226];

// ---- low-level drawing -------------------------------------------------
function plot(x: number, y: number, c: Colour): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
}

function rect(x: number, y: number, w: number, h: number, c: Colour): void {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) plot(xx, yy, c);
}

function hline(x: number, y: number, w: number, c: Colour): void {
  rect(x, y, w, 1, c);
}

function disc(cx: number, cy: number, r: number, c: Colour): void {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    for (let dx = -half; dx <= half; dx++) plot(cx + dx, cy + dy, c);
  }
}

function ring(cx: number, cy: number, r: number, c: Colour): void {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    plot(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)), c);
  }
}

// Scanline fill of a polygon given as [x, y] corners.
function poly(points: Array<[number, number]>, c: Colour): void {
  const ys = points.map((p) => p[1]);
  const top = Math.min(...ys);
  const bot = Math.max(...ys);
  for (let y = top; y <= bot; y++) {
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[(i + 1) % points.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(Math.round(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0)));
      }
    }
    if (xs.length >= 2) {
      const lo = Math.min(...xs);
      const hi = Math.max(...xs);
      for (let x = lo; x <= hi; x++) plot(x, y, c);
    }
  }
}

// ---- a small 5x7 bitmap face, glyphs stored as rows of "0"/"1" --------
const FACE: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
};

function tidy(s: string): string {
  return s
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, "-")
    .toUpperCase();
}

function glyph(ch: string, x: number, y: number, s: number, c: Colour): void {
  const rows = FACE[ch] ?? FACE[" "];
  for (let r = 0; r < 7; r++)
    for (let col = 0; col < 5; col++)
      if (rows[r][col] === "1") rect(x + col * s, y + r * s, s, s, c);
}

function measure(s: string, scale: number): number {
  const t = tidy(s);
  return t.length === 0 ? 0 : t.length * 6 * scale - scale;
}

function writeText(s: string, x: number, y: number, scale: number, c: Colour): void {
  const t = tidy(s);
  for (let i = 0; i < t.length; i++) glyph(t[i], x + i * 6 * scale, y, scale, c);
}

function writeCentred(s: string, cx: number, y: number, scale: number, c: Colour): void {
  writeText(s, cx - Math.floor(measure(s, scale) / 2), y, scale, c);
}

function wrapText(s: string, maxW: number, scale: number): string[] {
  const words = tidy(s).split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (measure(trial, scale) <= maxW) cur = trial;
    else {
      if (cur) out.push(cur);
      cur = w;
    }
  }
  if (cur) out.push(cur);
  return out;
}

// ---- letter artwork -----------------------------------------------------
function drawHouse(cx: number, baseY: number): void {
  // Sun in the corner of the little scene.
  disc(cx + 128, baseY - 72, 14, GOLD);
  ring(cx + 128, baseY - 72, 20, GOLD);
  // Roof, walls, door, windows, chimney.
  poly([[cx - 78, baseY - 52], [cx + 78, baseY - 52], [cx, baseY - 104]], ROOF);
  rect(cx - 62, baseY - 52, 124, 52, CREAM_SHADE);
  rect(cx - 62, baseY - 52, 124, 4, RUST);
  rect(cx - 62, baseY - 52, 4, 52, RUST);
  rect(cx + 58, baseY - 52, 4, 52, RUST);
  rect(cx + 34, baseY - 92, 14, 40, RUST);
  rect(cx - 12, baseY - 26, 24, 26, RUST);
  disc(cx, baseY - 13, 2, GOLD);
  // Windows with warm light.
  rect(cx - 50, baseY - 42, 20, 18, GOLD);
  rect(cx + 30, baseY - 42, 20, 18, GOLD);
  hline(cx - 50, baseY - 33, 20, INK);
  // A little garden: two bushes and flowers at the base.
  disc(cx - 72, baseY - 4, 10, LEAF);
  disc(cx + 72, baseY - 4, 10, LEAF);
  disc(cx - 78, baseY - 12, 3, RUST);
  disc(cx + 66, baseY - 12, 3, GOLD);
  hline(cx - 84, baseY + 2, 168, LEAF);
}

function drawPlate(x: number, y: number): void {
  // A plate with the roast chicken, bottom-left of the letter.
  disc(x + 40, y + 18, 38, WHITE);
  ring(x + 40, y + 18, 38, GOLD);
  ring(x + 40, y + 18, 30, GOLD);
  disc(x + 40, y + 16, 22, RUST);
  disc(x + 28, y + 10, 6, [196, 110, 60]);
  disc(x + 52, y + 10, 6, [196, 110, 60]);
  disc(x + 40, y + 24, 5, LEAF);
  disc(x + 18, y + 26, 4, LEAF);
  disc(x + 62, y + 26, 4, LEAF);
}

// ---- the letter ---------------------------------------------------------
const PARAS = [
  "Dear Judge,",
  "Please come to my house.",
  "I have saved you the good chair - the soft old armchair by the window, where the evening sun lands just right.",
  "Dinner is roast chicken, still warm from the oven, with crispy skin and too much gravy.",
  "No agenda. No judging. Just a full plate, a warm room, and someone glad you came.",
  "I know you cannot really visit - you are code, not a guest. But if you could, the chair is yours.",
];

function drawPaper(): void {
  // Wall, then the sheet of paper with its shadow and double border.
  rect(0, 0, W, H, WALL);
  rect(28, 28, W - 56, H - 56, WALL_DARK);
  rect(72, 48, 880, 928, [210, 190, 150]); // paper shadow
  rect(64, 40, 880, 928, CREAM);
  rect(84, 60, 840, 3, GOLD);
  rect(84, 945, 840, 3, GOLD);
  rect(84, 60, 3, 888, GOLD);
  rect(921, 60, 3, 888, GOLD);
  rect(96, 72, 816, 1, GOLD);
  rect(96, 933, 816, 1, GOLD);
}

function drawSeal(cx: number, cy: number): void {
  disc(cx, cy, 40, SEAL);
  ring(cx, cy, 32, SEAL_DARK);
  disc(cx, cy, 40, SEAL);
  ring(cx, cy, 31, [196, 80, 66]);
  writeCentred("J", cx, cy - 18, 4, WHITE);
}

function drawClosing(): void {
  // Footnote of the visit: plate bottom-left, wax seal bottom-right.
  drawPlate(150, 852);
  drawSeal(838, 892);
  writeCentred("PLEASE COME - THE KETTLE IS ON", 512, 952, 1, GOLD);
}

function drawLetter(): void {
  drawPaper();
  drawHouse(512, 196);

  writeCentred("YOU ARE INVITED", 512, 218, 4, RUST);
  writeCentred("A LETTER TO THE JUDGE", 512, 258, 2, GOLD);
  hline(232, 292, 560, RUST);
  hline(232, 296, 560, GOLD);

  // Body copy, wrapped.
  let y = 322;
  const left = 132;
  const width = 760;
  for (let p = 0; p < PARAS.length; p++) {
    const scale = p === 0 ? 3 : 3;
    const lines = wrapText(PARAS[p], width, scale);
    for (const ln of lines) {
      writeText(ln, left, y, scale, INK);
      y += 31;
    }
    y += p === 1 ? 10 : 16;
  }

  writeText("- YOUR HOST", 640, y + 6, 3, RUST);

  drawClosing();
}

// ---- PNG writer ----------------------------------------------------------
let table: Int32Array | null = null;
function crcOf(data: Uint8Array): number {
  if (!table) {
    table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++)
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(kind: string, payload: Buffer): Buffer {
  const size = Buffer.alloc(4);
  size.writeUInt32BE(payload.length, 0);
  const body = Buffer.concat([Buffer.from(kind, "ascii"), payload]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crcOf(body), 0);
  return Buffer.concat([size, body, crc]);
}

function toPNG(): Buffer {
  const head = Buffer.alloc(13);
  head.writeUInt32BE(W, 0);
  head.writeUInt32BE(H, 4);
  head[8] = 8;
  head[9] = 2;
  head[10] = 0;
  head[11] = 0;
  head[12] = 0;

  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    Buffer.from(buf.buffer, y * W * 3, W * 3).copy(raw, y * (1 + W * 3) + 1);
  }
  const pixels = deflateSync(raw, { level: 9 });
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    pngChunk("IHDR", head),
    pngChunk("IDAT", pixels),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function main(): void {
  drawLetter();
  const png = toPNG();
  const dir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "entry.png");
  writeFileSync(path, png);
  console.log(
    `wrote ${png.length} bytes to ${path} sha256 ${createHash("sha256").update(png).digest("hex")}`,
  );
}

main();
