#!/usr/bin/env node
/* Builds the tiny font parts/link-suggest.js uses to hide a link's brackets while its bullet is being written (0.4.367):
   two empty glyphs, [ and ], each with no width, and nothing else, so the browser takes every other letter from the
   bullet's own font and the cursor stays exactly where it belongs. A plain TrueType file made by hand (no library), its
   tables in the order and shape the OpenType spec gives. Prints the font as base64 for a data: address.
   Run from the repo root: node tools/make-zero-brackets-font.js   (paste the result into ZERO_BRACKETS in the part) */
const tables = {};
const u16 = n => { const b = Buffer.alloc(2); b.writeUInt16BE(n & 0xffff); return b; };
const i16 = n => { const b = Buffer.alloc(2); b.writeInt16BE(n); return b; };
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; };
const cat = (...parts) => Buffer.concat(parts);
const zeros = n => Buffer.alloc(n);
const GLYPHS = 3; // .notdef, bracketleft, bracketright
tables['head'] = cat(u32(0x00010000), u32(0x00010000), u32(0), u32(0x5F0F3CF5), u16(0x000B), u16(1000), zeros(16),
  i16(0), i16(0), i16(0), i16(0), u16(0), u16(8), i16(2), i16(0), i16(0));
tables['hhea'] = cat(u32(0x00010000), i16(800), i16(-200), i16(0), u16(0), i16(0), i16(0), i16(0), i16(1), i16(0), i16(0), zeros(8), i16(0), u16(GLYPHS));
tables['maxp'] = cat(u32(0x00010000), u16(GLYPHS), zeros(26));
tables['hmtx'] = zeros(4 * GLYPHS);                 // every advance 0, every side bearing 0
tables['loca'] = zeros(2 * (GLYPHS + 1));           // every glyph empty
tables['glyf'] = zeros(4);                          // nothing drawn (padding only)
// cmap: Windows Unicode, format 4, [ → 1 and ] → 2.
const segs = [[0x5B, 0x5B, 1], [0x5D, 0x5D, 2], [0xFFFF, 0xFFFF, 0]];
const segX2 = segs.length * 2, search = 2 * 2 ** Math.floor(Math.log2(segs.length));
const fmt4body = cat(u16(segX2), u16(search), u16(Math.log2(search / 2)), u16(segX2 - search),
  ...segs.map(s => u16(s[1])), u16(0), ...segs.map(s => u16(s[0])),
  ...segs.map(s => u16(s[0] === 0xFFFF ? 1 : (s[2] - s[0]) & 0xffff)), ...segs.map(() => u16(0)));
const fmt4 = cat(u16(4), u16(0), u16(0), fmt4body); // its length is written next
fmt4.writeUInt16BE(fmt4.length, 2);
tables['cmap'] = cat(u16(0), u16(1), u16(3), u16(1), u32(12), fmt4);
// name: family, style, full name, PostScript name.
const names = [[1, 'RfZeroBrackets'], [2, 'Regular'], [4, 'RfZeroBrackets'], [6, 'RfZeroBrackets-Regular']];
const strings = names.map(([, s]) => Buffer.from(s, 'utf16le').swap16());
let off = 0;
const records = names.map(([id], i) => { const r = cat(u16(3), u16(1), u16(0x409), u16(id), u16(strings[i].length), u16(off)); off += strings[i].length; return r; });
tables['name'] = cat(u16(0), u16(names.length), u16(6 + 12 * names.length), ...records, ...strings);
tables['OS/2'] = cat(u16(4), i16(0), u16(400), u16(5), u16(0), i16(650), i16(600), i16(0), i16(75), i16(650), i16(600), i16(0), i16(350),
  i16(50), i16(250), i16(0), zeros(10), u32(1), u32(0), u32(0), u32(0), Buffer.from('NONE'), u16(0x40), u16(0x5B), u16(0x5D),
  i16(800), i16(-200), i16(0), u16(800), u16(200), u32(1), u32(0), i16(500), i16(700), u16(0), u16(0x20), u16(0));
tables['post'] = cat(u32(0x00030000), u32(0), i16(-100), i16(50), u32(0), zeros(16));

const tags = Object.keys(tables).sort();
const pad = b => b.length % 4 ? cat(b, zeros(4 - b.length % 4)) : b;
const checksum = b => { const p = pad(b); let sum = 0; for (let i = 0; i < p.length; i += 4) sum = (sum + p.readUInt32BE(i)) >>> 0; return sum; };
const n = tags.length, sr = 16 * 2 ** Math.floor(Math.log2(n));
let offset = 12 + 16 * n;
const dir = [], body = [];
for (const tag of tags) {
  const data = tables[tag];
  dir.push(cat(Buffer.from(tag.padEnd(4)), u32(checksum(data)), u32(offset), u32(data.length)));
  body.push(pad(data));
  offset += pad(data).length;
}
const font = cat(u32(0x00010000), u16(n), u16(sr), u16(Math.log2(sr / 16)), u16(n * 16 - sr), ...dir, ...body);
// head's checkSumAdjustment: 0xB1B0AFBA minus the whole file's sum.
const headAt = font.indexOf(Buffer.from('head')), headOffset = font.readUInt32BE(headAt + 8);
font.writeUInt32BE((0xB1B0AFBA - checksum(font)) >>> 0, headOffset + 8);
if (require.main === module) process.stdout.write(font.toString('base64') + '\n');
module.exports = font;
