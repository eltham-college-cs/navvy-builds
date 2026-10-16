/**
 * Draws the hobby image library: public/images/hobbies/<hobby>-1.png … -3.png.
 * Each picture is drawn on a 100×75 grid and scaled ×4 to 400×300, so it reads
 * as pixel art. Made for the site, so there are no copyright questions.
 *
 *   npm run images
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const W = 100;
const H = 75;
const SCALE = 4;
const OUT = new URL('../public/images/hobbies/', import.meta.url);

const C = {
  sky: '#7CC4F2', skyDark: '#4FA3DC', navy: '#0A1B2E', navy2: '#163351', gold: '#F2B533',
  goldDark: '#B07D12', goldLight: '#FFE08A', green: '#1F9D5C', greenDark: '#157A46',
  greenLight: '#3DBB75', white: '#FFFFFF', cream: '#FFF1C9', red: '#D9455F', redDark: '#A62E45',
  blue: '#2F7DD1', blueDark: '#1F5A9E', water: '#3E9BE0', waterLight: '#8FD0FA', pink: '#F59AB5',
  purple: '#7B5CC4', purpleDark: '#4E3A8A', orange: '#F08A3C', brown: '#8A5A33', brownDark: '#5E3A1E',
  grey: '#9AA7B5', greyDark: '#5F6B78', black: '#1A1D21', wall: '#F4E6C8', floor: '#C98F5A', page: '#FBFAF5',
  night: '#1B2440', skin: '#F2C29B',
};

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

class Pic {
  constructor() {
    this.px = new Array(W * H).fill(C.sky);
  }
  set(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < W && y < H) this.px[y * W + x] = c;
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }
  /** A rectangle with a navy outline. */
  box(x, y, w, h, fill, line = C.navy) {
    this.rect(x, y, w, h, line);
    return this.rect(x + 1, y + 1, w - 2, h - 2, fill);
  }
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) this.set(x, y, c);
    return this;
  }
  circle(cx, cy, r, c) {
    return this.ellipse(cx, cy, r, r, c);
  }
  /** Filled circle with a navy outline. */
  disc(cx, cy, r, fill, line = C.navy) {
    this.circle(cx, cy, r, line);
    return this.circle(cx, cy, r - 1, fill);
  }
  line(x0, y0, x1, y1, c, t = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n;
      const y = y0 + ((y1 - y0) * k) / n;
      this.rect(Math.round(x - (t - 1) / 2), Math.round(y - (t - 1) / 2), t, t, c);
    }
    return this;
  }
  arc(cx, cy, r, a0, a1, c, t = 1) {
    const steps = Math.ceil(r * (a1 - a0));
    for (let k = 0; k <= steps; k++) {
      const a = a0 + ((a1 - a0) * k) / steps;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      this.rect(Math.round(x - (t - 1) / 2), Math.round(y - (t - 1) / 2), t, t, c);
    }
    return this;
  }
  poly(points, c) {
    const ys = points.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++) {
      for (let x = 0; x < W; x++) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const [xi, yi] = points[i];
          const [xj, yj] = points[j];
          if (yi > y + 0.5 !== yj > y + 0.5 && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) this.set(x, y, c);
      }
    }
    return this;
  }
  /** Pixel sprite from strings; each character is looked up in the palette. */
  sprite(x, y, rows, pal, s = 1) {
    rows.forEach((row, j) =>
      [...row].forEach((ch, i) => {
        if (pal[ch]) this.rect(x + i * s, y + j * s, s, s, pal[ch]);
      }),
    );
    return this;
  }
  /* scenes */
  sky(c = C.sky) {
    this.rect(0, 0, W, H, c);
    this.cloud(12, 10).cloud(70, 6);
    return this;
  }
  cloud(x, y) {
    return this.rect(x, y + 3, 16, 4, C.white).rect(x + 3, y, 7, 3, C.white).rect(x + 9, y + 1, 4, 2, C.white);
  }
  grass(top = 58) {
    this.rect(0, top, W, H - top, C.green);
    for (let x = 0; x < W; x += 8) this.rect(x, top, 4, H - top, C.greenLight);
    return this.rect(0, top, W, 1, C.greenDark);
  }
  ground(top = 64) {
    for (let x = 0; x < W; x += 8) this.rect(x, top, 8, H - top, x % 16 ? C.navy : C.navy2);
    return this.rect(0, top, W, 2, C.gold);
  }
  room(floor = 56, wall = C.wall) {
    this.rect(0, 0, W, H, wall);
    for (let y = 4; y < floor; y += 10) this.rect(0, y, W, 1, '#EAD6AE');
    this.rect(0, floor, W, H - floor, C.floor);
    for (let x = 0; x < W; x += 12) this.rect(x, floor, 1, H - floor, C.brown);
    return this.rect(0, floor, W, 1, C.brownDark);
  }
  night() {
    this.rect(0, 0, W, H, C.night);
    for (const [x, y] of [[8, 6], [24, 14], [41, 4], [60, 11], [77, 5], [90, 16], [15, 26], [85, 30]]) this.set(x, y, C.goldLight);
    return this;
  }
  sparkle(x, y, c = C.goldLight) {
    return this.rect(x, y - 2, 1, 5, c).rect(x - 2, y, 5, 1, c);
  }
  water(top = 40) {
    this.rect(0, top, W, H - top, C.water);
    for (let y = top + 3; y < H; y += 6)
      for (let x = (y / 6) % 2 ? 0 : 5; x < W; x += 12) this.rect(x, y, 6, 1, C.waterLight);
    return this;
  }
  png() {
    const w = W * SCALE;
    const h = H * SCALE;
    const raw = Buffer.alloc((w * 3 + 1) * h);
    for (let y = 0; y < h; y++) {
      raw[y * (w * 3 + 1)] = 0;
      for (let x = 0; x < w; x++) {
        const [r, g, b] = hex(this.px[Math.floor(y / SCALE) * W + Math.floor(x / SCALE)]);
        const o = y * (w * 3 + 1) + 1 + x * 3;
        raw[o] = r;
        raw[o + 1] = g;
        raw[o + 2] = b;
      }
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8;
    ihdr[9] = 2;
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/* ------------------------------------------------------------- pictures */

const ball = (p, cx, cy, r) => {
  p.disc(cx, cy, r, C.white);
  const k = r / 10;
  p.poly([[cx, cy - 3 * k], [cx + 3 * k, cy - k], [cx + 2 * k, cy + 3 * k], [cx - 2 * k, cy + 3 * k], [cx - 3 * k, cy - k]], C.navy);
  for (const [dx, dy] of [[0, -8], [7.5, -2.5], [4.5, 7], [-4.5, 7], [-7.5, -2.5]]) p.circle(cx + dx * k, cy + dy * k, 2 * k, C.navy);
  return p;
};

const book = (p, x, y, w, h, c, dark) => {
  p.box(x, y, w, h, c);
  p.rect(x + 1, y + 1, 2, h - 2, dark);
  return p.rect(x + w - 4, y + 2, 2, h - 4, C.cream);
};

const note = (p, x, y, c = C.navy) => p.ellipse(x, y, 3.5, 2.5, c).rect(x + 2, y - 14, 2, 14, c);

const pics = {
  football: [
    (p) => {
      p.sky().grass(52);
      p.rect(0, 52, W, 1, C.white);
      ball(p, 50, 44, 14);
      return p;
    },
    (p) => {
      p.sky().grass(56);
      p.rect(18, 14, 64, 3, C.white).rect(18, 14, 3, 44, C.white).rect(79, 14, 3, 44, C.white);
      for (let x = 24; x < 79; x += 5) p.rect(x, 17, 1, 40, '#D7E3EF');
      for (let y = 20; y < 57; y += 5) p.rect(21, y, 58, 1, '#D7E3EF');
      ball(p, 50, 63, 8);
      return p;
    },
    (p) => {
      p.sky().ground(64);
      p.poly([[34, 12], [66, 12], [62, 34], [38, 34]], C.navy).poly([[36, 14], [64, 14], [60, 32], [40, 32]], C.gold);
      p.rect(38, 15, 4, 14, C.goldLight);
      p.ellipse(31, 20, 5, 7, C.navy).ellipse(31, 20, 3, 5, C.sky).ellipse(69, 20, 5, 7, C.navy).ellipse(69, 20, 3, 5, C.sky);
      p.box(46, 33, 8, 14, C.goldDark).box(36, 46, 28, 8, C.gold).box(32, 53, 36, 8, C.navy2);
      p.sparkle(22, 40).sparkle(80, 44).sparkle(76, 10);
      ball(p, 50, 23, 5);
      return p;
    },
  ],
  gaming: [
    (p) => {
      p.night().ground(64);
      p.ellipse(28, 40, 16, 14, C.navy).ellipse(72, 40, 16, 14, C.navy).rect(26, 26, 48, 26, C.navy);
      p.ellipse(28, 40, 14, 12, C.purple).ellipse(72, 40, 14, 12, C.purple).rect(27, 28, 46, 22, C.purple);
      p.rect(20, 37, 14, 4, C.navy).rect(25, 32, 4, 14, C.navy);
      p.disc(70, 34, 3, C.gold).disc(78, 40, 3, C.red).disc(62, 40, 3, C.green).disc(70, 46, 3, C.blue);
      p.rect(44, 34, 5, 2, C.purpleDark).rect(52, 34, 5, 2, C.purpleDark);
      return p;
    },
    (p) => {
      p.room(60);
      p.box(14, 6, 72, 50, C.navy2).rect(18, 10, 64, 40, C.sky);
      p.cloud(24, 14);
      for (let x = 18; x < 82; x += 6) p.rect(x, 42, 6, 8, x % 12 ? C.navy : C.navy2);
      p.rect(18, 42, 64, 1, C.gold);
      p.box(56, 24, 9, 9, C.gold).rect(59, 27, 3, 3, C.navy);
      p.sprite(30, 32, ['.KK.', 'KRRK', 'KSSK', 'KBBK', 'K..K'], { K: C.navy, R: C.red, S: C.skin, B: C.blue }, 2);
      p.rect(44, 56, 12, 6, C.greyDark).rect(36, 61, 28, 3, C.grey);
      return p;
    },
    (p) => {
      p.sky(C.skyDark).ground(66);
      p.box(32, 6, 36, 60, C.cream);
      p.box(36, 10, 28, 22, C.greenDark);
      p.rect(39, 20, 6, 4, C.greenLight).rect(47, 16, 4, 4, C.gold).rect(53, 22, 6, 4, C.greenLight);
      p.rect(38, 42, 10, 3, C.navy).rect(41, 39, 3, 9, C.navy);
      p.disc(56, 41, 3, C.red).disc(62, 45, 3, C.blue);
      p.rect(42, 54, 6, 2, C.greyDark).rect(52, 54, 6, 2, C.greyDark);
      p.sparkle(18, 20).sparkle(84, 30);
      return p;
    },
  ],
  music: [
    (p) => {
      p.rect(0, 0, W, H, C.cream);
      for (let y = 20; y <= 52; y += 8) p.rect(6, y, 88, 1, C.navy2);
      note(p, 28, 52);
      note(p, 50, 40, C.navy);
      note(p, 66, 44, C.navy);
      p.rect(52, 26, 16, 3, C.navy);
      note(p, 84, 36, C.red);
      return p;
    },
    (p) => {
      p.room(62, '#FDE7C8');
      p.line(50, 6, 50, 34, C.brownDark, 5).rect(46, 2, 9, 6, C.navy);
      for (let y = 10; y < 32; y += 5) p.rect(48, y, 5, 1, C.goldLight);
      p.disc(50, 40, 11, C.orange).disc(50, 55, 15, C.orange);
      p.disc(50, 44, 4, C.navy);
      p.rect(44, 56, 13, 3, C.brownDark);
      p.rect(49, 20, 1, 38, C.white).rect(51, 20, 1, 38, C.white);
      return p;
    },
    (p) => {
      p.rect(0, 0, W, H, C.purple);
      for (let x = 0; x < W; x += 10) p.rect(x, 0, 5, H, C.purpleDark);
      p.arc(50, 40, 26, Math.PI, 2 * Math.PI, C.navy, 7).arc(50, 40, 26, Math.PI, 2 * Math.PI, C.grey, 3);
      p.box(16, 36, 16, 26, C.red).box(68, 36, 16, 26, C.red).rect(19, 40, 4, 18, C.redDark).rect(71, 40, 4, 18, C.redDark);
      note(p, 50, 56, C.gold);
      return p;
    },
  ],
  art: [
    (p) => {
      p.room(60);
      p.ellipse(50, 36, 34, 24, C.navy).ellipse(50, 36, 32, 22, C.cream);
      p.circle(62, 46, 6, C.navy).circle(62, 46, 5, C.wall);
      [[30, 28, C.red], [44, 20, C.gold], [60, 22, C.blue], [74, 32, C.green], [32, 44, C.purple]].forEach(([x, y, c]) => p.disc(x, y, 5, c));
      p.line(70, 70, 90, 46, C.brown, 3).rect(88, 42, 5, 6, C.navy);
      return p;
    },
    (p) => {
      p.room(62);
      p.line(30, 74, 44, 8, C.brownDark, 3).line(70, 74, 56, 8, C.brownDark, 3).line(50, 8, 50, 74, C.brownDark, 3);
      p.box(24, 12, 52, 38, C.white);
      p.rect(25, 13, 50, 20, C.sky).rect(25, 33, 50, 16, C.green);
      p.disc(64, 22, 6, C.gold);
      p.poly([[30, 40], [42, 24], [54, 40]], C.greyDark).poly([[38, 29], [42, 24], [46, 29]], C.white);
      p.rect(20, 50, 60, 3, C.brownDark);
      return p;
    },
    (p) => {
      p.rect(0, 0, W, H, C.page);
      [[18, C.red], [34, C.gold], [50, C.green], [66, C.blue], [82, C.purple]].forEach(([x, c], i) => {
        const top = 12 + (i % 2) * 6;
        p.box(x - 5, top, 10, 44, c);
        p.rect(x - 3, top + 2, 2, 40, C.white);
        p.poly([[x - 5, top + 44], [x + 5, top + 44], [x, top + 54]], C.skin);
        p.poly([[x - 2, top + 50], [x + 2, top + 50], [x, top + 54]], c);
      });
      return p;
    },
  ],
  cooking: [
    (p) => {
      p.room(58, '#DDEFF8');
      p.rect(14, 46, 72, 6, C.greyDark).box(16, 30, 50, 18, C.black).rect(66, 36, 30, 6, C.navy);
      p.ellipse(41, 38, 22, 7, C.greyDark).ellipse(41, 38, 20, 6, '#3A3F47');
      p.ellipse(40, 38, 12, 5, C.white).circle(41, 37, 4, C.gold).rect(39, 35, 2, 1, C.goldLight);
      for (const x of [30, 41, 52]) p.rect(x, 18, 1, 6, C.grey).rect(x + 1, 14, 1, 4, C.grey);
      return p;
    },
    (p) => {
      p.rect(0, 0, W, H, '#FDE2EA');
      for (let x = 0; x < W; x += 10) for (let y = 0; y < H; y += 10) p.rect(x + ((y / 10) % 2) * 5, y, 2, 2, C.white);
      p.poly([[30, 40], [70, 40], [64, 68], [36, 68]], C.navy).poly([[32, 42], [68, 42], [62, 66], [38, 66]], C.orange);
      for (let x = 38; x < 64; x += 6) p.rect(x, 42, 2, 24, C.brown);
      p.ellipse(50, 34, 24, 10, C.navy).ellipse(50, 34, 22, 8, C.pink).ellipse(50, 26, 16, 8, C.pink).ellipse(50, 20, 9, 5, C.pink);
      p.disc(50, 12, 4, C.red).rect(50, 6, 1, 3, C.greenDark);
      [[38, 30], [58, 28], [46, 22], [62, 34], [44, 36]].forEach(([x, y], i) => p.rect(x, y, 2, 1, [C.blue, C.gold, C.green][i % 3]));
      return p;
    },
    (p) => {
      p.room(66, '#E8F5E9');
      p.ellipse(50, 40, 34, 26, C.navy).ellipse(50, 40, 32, 24, C.goldDark).ellipse(50, 40, 28, 20, C.gold);
      p.ellipse(50, 40, 26, 18, C.red).ellipse(50, 40, 24, 16, '#F7D36B');
      [[38, 32], [56, 30], [62, 44], [44, 48], [50, 38], [32, 44]].forEach(([x, y]) => p.disc(x, y, 4, C.redDark));
      [[46, 30], [60, 37], [38, 40], [54, 48]].forEach(([x, y]) => p.rect(x, y, 3, 2, C.greenDark));
      p.line(50, 40, 50, 16, C.navy).line(50, 40, 74, 50, C.navy);
      return p;
    },
  ],
  dance: [
    (p) => {
      p.night();
      p.rect(49, 0, 2, 14, C.grey);
      p.disc(50, 30, 16, C.grey);
      for (let y = 15; y < 46; y += 4) for (let x = 34; x < 66; x += 4) if ((x - 50) ** 2 + (y + 1.5 - 30) ** 2 < 196) p.rect(x, y, 3, 3, (x + y) % 8 ? '#C9D3DD' : C.white);
      p.sparkle(20, 20).sparkle(80, 14).sparkle(84, 50).sparkle(14, 52).sparkle(30, 62, C.pink).sparkle(70, 66, C.sky);
      return p;
    },
    (p) => {
      p.rect(0, 0, W, H, C.navy);
      p.poly([[38, 0], [62, 0], [80, 64], [20, 64]], '#2A3F66');
      p.rect(0, 64, W, 11, C.brownDark).rect(0, 64, W, 2, C.gold);
      p.sprite(38, 18, [
        'K.....KKK.....K',
        'KS...KSSSK...SK',
        '.KS..KSSSK..SK.',
        '..KS..KKK..SK..',
        '...KRRRRRRRK...',
        '....KRRRRRK....',
        '....KRRRRRK....',
        '...KRRRRRRRK...',
        '..KRRRRRRRRRK..',
        '.....KB.BK.....',
        '.....KB.BK.....',
        '....KBB.BBK....',
      ], { K: C.navy, S: C.skin, R: C.pink, B: C.blue }, 2).rect(34, 10, 4, 1, C.goldLight);
      p.sparkle(16, 16).sparkle(84, 24);
      return p;
    },
    (p) => {
      p.rect(0, 0, W, H, C.night);
      const cols = [C.pink, C.gold, C.sky, C.green, C.purple];
      for (let y = 30; y < H; y += 9) for (let x = 0; x < W; x += 10) p.box(x, y, 10, 9, cols[(x / 10 + Math.floor(y / 9)) % 5]);
      note(p, 26, 22, C.gold);
      note(p, 50, 16, C.pink);
      note(p, 74, 22, C.sky);
      return p;
    },
  ],
  reading: [
    (p) => {
      p.room(62);
      book(p, 22, 50, 56, 10, C.red, C.redDark);
      book(p, 26, 40, 50, 10, C.blue, C.blueDark);
      book(p, 20, 30, 54, 10, C.green, C.greenDark);
      book(p, 28, 20, 44, 10, C.gold, C.goldDark);
      p.disc(76, 14, 5, C.white).rect(72, 18, 8, 3, C.cream);
      return p;
    },
    (p) => {
      p.rect(0, 0, W, H, C.purple);
      p.poly([[50, 22], [12, 14], [10, 60], [50, 66]], C.navy).poly([[50, 22], [88, 14], [90, 60], [50, 66]], C.navy);
      p.poly([[49, 24], [14, 17], [13, 58], [49, 63]], C.white).poly([[51, 24], [86, 17], [87, 58], [51, 63]], C.white);
      for (let y = 26; y < 56; y += 5) {
        p.rect(18, y, 26, 1, C.grey);
        p.rect(56, y, 26, 1, C.grey);
      }
      p.rect(49, 22, 2, 44, C.navy2);
      p.sparkle(20, 8).sparkle(80, 6).sparkle(50, 10);
      return p;
    },
    (p) => {
      p.room(70, '#F4E6C8');
      p.box(10, 6, 80, 64, C.brown, C.brownDark);
      for (const y of [8, 30, 52]) {
        p.rect(11, y + 18, 78, 3, C.brownDark);
        let x = 13;
        const cols = [C.red, C.blue, C.gold, C.green, C.purple, C.orange, C.pink, C.navy2];
        for (let i = 0; x < 84; i++) {
          const w = 4 + ((i * 7 + y) % 4);
          const h = 13 + ((i * 5 + y) % 5);
          p.box(x, y + 18 - h, w, h, cols[(i + y) % cols.length]);
          x += w + 1;
        }
      }
      return p;
    },
  ],
  animals: [
    (p) => {
      p.sky().grass(60);
      p.poly([[30, 34], [32, 10], [46, 26]], C.navy).poly([[70, 34], [68, 10], [54, 26]], C.navy);
      p.poly([[32, 30], [33, 14], [43, 25]], C.orange).poly([[68, 30], [67, 14], [57, 25]], C.orange);
      p.ellipse(50, 42, 24, 20, C.navy).ellipse(50, 42, 22, 18, C.orange);
      p.rect(38, 22, 3, 6, C.goldDark).rect(48, 22, 3, 8, C.goldDark).rect(58, 22, 3, 6, C.goldDark);
      p.ellipse(41, 40, 3, 4, C.navy).ellipse(59, 40, 3, 4, C.navy).rect(41, 38, 1, 1, C.white).rect(59, 38, 1, 1, C.white);
      p.poly([[47, 47], [53, 47], [50, 50]], C.pink);
      for (const y of [48, 52]) {
        p.line(20, y - 2, 36, y, C.navy);
        p.line(64, y, 80, y - 2, C.navy);
      }
      return p;
    },
    (p) => {
      p.sky().grass(60);
      p.ellipse(50, 40, 22, 22, C.navy).ellipse(50, 40, 20, 20, C.goldLight);
      p.ellipse(28, 40, 7, 16, C.navy).ellipse(28, 40, 5, 14, C.brown).ellipse(72, 40, 7, 16, C.navy).ellipse(72, 40, 5, 14, C.brown);
      p.ellipse(56, 30, 8, 6, C.brown);
      p.disc(42, 36, 3, C.navy).disc(58, 36, 3, C.navy);
      p.ellipse(50, 50, 10, 7, C.white).ellipse(50, 46, 4, 3, C.navy);
      p.rect(48, 54, 4, 5, C.red);
      return p;
    },
    (p) => {
      p.room(66, '#DDEFF8');
      p.ellipse(50, 40, 34, 28, C.navy).ellipse(50, 40, 32, 26, '#CFEAFB');
      p.ellipse(50, 46, 31, 18, C.water);
      p.rect(18, 26, 64, 4, C.navy).rect(20, 27, 60, 2, C.white);
      p.ellipse(48, 46, 11, 7, C.navy).ellipse(48, 46, 9, 5, C.orange).poly([[58, 46], [68, 38], [68, 54]], C.navy).poly([[59, 46], [66, 41], [66, 51]], C.orange);
      p.disc(42, 44, 2, C.navy);
      p.circle(32, 36, 2, C.waterLight).circle(36, 30, 1, C.waterLight);
      p.rect(36, 60, 30, 4, C.gold);
      return p;
    },
  ],
  swimming: [
    (p) => {
      p.water(0);
      for (const y of [18, 37, 56]) for (let x = 0; x < W; x += 6) p.rect(x, y, 3, 2, x % 12 ? C.red : C.white);
      p.ellipse(58, 28, 18, 4, C.skin).line(40, 26, 28, 18, C.skin, 3).line(74, 28, 86, 32, C.skin, 3);
      p.ellipse(40, 27, 6, 5, C.skin).ellipse(40, 25, 6, 3, C.red).rect(42, 27, 3, 1, C.navy);
      for (const x of [26, 88]) p.rect(x, 24, 4, 1, C.white).rect(x - 2, 27, 3, 1, C.white);
      p.rect(0, 0, W, 6, C.white).rect(0, 6, W, 1, C.grey);
      return p;
    },
    (p) => {
      p.rect(0, 0, W, H, C.waterLight);
      p.water(56);
      p.rect(10, 30, 80, 4, C.navy);
      p.ellipse(32, 32, 16, 12, C.navy).ellipse(68, 32, 16, 12, C.navy);
      p.ellipse(32, 32, 14, 10, C.blue).ellipse(68, 32, 14, 10, C.blue);
      p.ellipse(32, 32, 11, 7, '#BEE6FF').ellipse(68, 32, 11, 7, '#BEE6FF');
      p.rect(26, 28, 4, 2, C.white).rect(62, 28, 4, 2, C.white);
      p.rect(46, 30, 8, 4, C.navy);
      return p;
    },
    (p) => {
      p.sky().water(46);
      p.ellipse(50, 46, 22, 12, C.navy).ellipse(50, 46, 20, 10, C.gold);
      p.disc(60, 30, 11, C.gold);
      p.poly([[69, 31], [80, 29], [80, 35], [69, 35]], C.navy).poly([[70, 32], [78, 31], [78, 34], [70, 34]], C.orange);
      p.disc(63, 27, 2, C.navy);
      p.ellipse(44, 44, 10, 5, C.goldDark).ellipse(44, 43, 9, 4, C.gold);
      p.water(52);
      return p;
    },
  ],
  other: [
    (p) => {
      p.sky().ground(64);
      p.poly([[50, 6], [58, 26], [80, 27], [63, 40], [69, 61], [50, 49], [31, 61], [37, 40], [20, 27], [42, 26]], C.navy);
      p.poly([[50, 10], [56.5, 28], [76, 29], [61, 40], [66, 57], [50, 47], [34, 57], [39, 40], [24, 29], [43.5, 28]], C.gold);
      p.disc(44, 34, 2, C.navy).disc(56, 34, 2, C.navy).rect(46, 41, 8, 2, C.navy);
      return p;
    },
    (p) => {
      p.rect(0, 0, W, H, '#FDE2EA');
      p.circle(36, 28, 16, C.navy).circle(64, 28, 16, C.navy).poly([[21, 33], [79, 33], [50, 66]], C.navy);
      p.circle(36, 28, 14, C.red).circle(64, 28, 14, C.red).poly([[24, 33], [76, 33], [50, 62]], C.red);
      p.rect(28, 20, 6, 4, C.pink);
      p.sparkle(14, 14).sparkle(86, 56).sparkle(84, 12);
      return p;
    },
    (p) => {
      p.night();
      p.poly([[50, 4], [60, 22], [60, 50], [40, 50], [40, 22]], C.navy).poly([[50, 7], [58, 23], [58, 48], [42, 48], [42, 23]], C.white);
      p.disc(50, 28, 5, C.blue);
      p.poly([[40, 36], [30, 54], [40, 50]], C.red).poly([[60, 36], [70, 54], [60, 50]], C.red);
      p.poly([[44, 50], [56, 50], [50, 68]], C.gold).poly([[47, 50], [53, 50], [50, 62]], C.orange);
      return p;
    },
  ],
};

mkdirSync(OUT, { recursive: true });
let count = 0;
for (const [hobby, list] of Object.entries(pics)) {
  list.forEach((draw, i) => {
    const pic = new Pic();
    draw(pic);
    writeFileSync(new URL(`${hobby}-${i + 1}.png`, OUT), pic.png());
    count++;
  });
}
console.log(`Drew ${count} pictures in public/images/hobbies/`);
