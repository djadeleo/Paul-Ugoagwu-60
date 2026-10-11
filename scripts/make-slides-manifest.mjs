// Scans public/images/slidehome and writes src/generated/slides.json.
// Optional: put an alts.json in that folder: { "photo1.jpg": "Paul cutting his cake" }
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'public', 'images', 'slidehome');
const out = path.join(process.cwd(), 'src', 'generated', 'slides.json');
const IMG = /\.(jpe?g|png|webp|avif)$/i;
const VID = /\.(mp4|webm|mov)$/i;

let alts = {};
try { alts = JSON.parse(fs.readFileSync(path.join(dir, 'alts.json'), 'utf8')); } catch {}

let files = [];
try { files = fs.readdirSync(dir).filter((f) => IMG.test(f) || VID.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); } catch {}

const slides = files.map((f, i) => ({
  src: `/images/slidehome/${encodeURIComponent(f)}`,
  type: VID.test(f) ? 'video' : 'image',
  alt: alts[f] || `Paul Ugoagwu celebrating, photo ${i + 1}`,
}));

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(slides, null, 2));
console.log(`slides manifest: ${slides.length} item(s)`);
