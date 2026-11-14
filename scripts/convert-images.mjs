// Converts every jpg/jpeg/png in public/images into AVIF + WebP next to the original.
//   bun run images            convert what is missing or outdated
//   bun run images --force    convert everything again
//   bun run images --check    exit 1 if anything is missing or outdated (nothing is written)
//   bun run images some/dir   use other folders instead of public/images
// Runs automatically before `bun run build` (see "prebuild" in package.json). The generated files are git-ignored.
import { MAX_WIDTH, DEFAULT_DIRS, convertAll, listSources, pending } from "./images-lib.mjs";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const dirs = args.filter((a) => !a.startsWith("--"));
const folders = dirs.length ? dirs : DEFAULT_DIRS;

if (!listSources(folders).length) {
  console.log(`No jpg/jpeg/png images found in ${folders.join(", ")}.`);
  process.exit(0);
}

if (flags.has("--check")) {
  const todo = pending(folders);
  if (todo.length) {
    console.error(`${todo.length} converted image(s) missing or outdated. Run: bun run images`);
    todo.forEach((t) => console.error(`  ${t.out}`));
    process.exit(1);
  }
  console.log("All images are converted.");
  process.exit(0);
}

const { converted, skipped, failed } = await convertAll({ dirs: folders, force: flags.has("--force"), log: console.log });
console.log(`Done: ${converted.length} converted, ${skipped.length} up to date, max width ${MAX_WIDTH}px.`);
if (failed.length) {
  failed.forEach((f) => console.error(`FAILED ${f.out}: ${f.error}`));
  process.exit(1);
}
