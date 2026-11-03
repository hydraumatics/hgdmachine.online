// Converts every video in media-src/ into web-ready files in public/media/:
//   <name>.webm (VP9, smallest, modern browsers) + <name>.mp4 (H.264, works everywhere) + <name>.jpg (poster frame)
// Needs ffmpeg installed (https://ffmpeg.org). Run: npm run media
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";

const SRC = "media-src", OUT = "public/media";
try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); } catch { console.error("ffmpeg not found. Install it first (Linux: sudo apt install ffmpeg)."); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const files = existsSync(SRC) ? readdirSync(SRC).filter((f) => /\.(mp4|mov|mkv|avi|webm)$/i.test(f)) : [];
if (!files.length) console.log(`No videos found in ${SRC}/. Put source files there (for example hero.mp4) and run again.`);
const scale = "scale='min(1920,iw)':-2,fps=24"; // max 1080p wide, 24 fps, even dimensions
for (const f of files) {
  const name = basename(f, extname(f)).toLowerCase().replace(/[^a-z0-9-]+/g, "-"), input = join(SRC, f);
  const newer = (out) => existsSync(out) && statSync(out).mtimeMs > statSync(input).mtimeMs;
  const run = (out, args) => { if (newer(out)) return console.log("up to date:", out); console.log("creating:", out); execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", input, ...args, out], { stdio: "inherit" }); };
  run(join(OUT, `${name}.webm`), ["-an", "-vf", scale, "-c:v", "libvpx-vp9", "-crf", "36", "-b:v", "0", "-row-mt", "1", "-pix_fmt", "yuv420p"]);
  run(join(OUT, `${name}.mp4`), ["-an", "-vf", scale, "-c:v", "libx264", "-profile:v", "main", "-crf", "27", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]);
  run(join(OUT, `${name}.jpg`), ["-ss", "1", "-frames:v", "1", "-vf", "scale='min(1920,iw)':-2", "-q:v", "4"]);
}
console.log("Done. Use <VideoHero name=\"hero\" /> in a page.");
