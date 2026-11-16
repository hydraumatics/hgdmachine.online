// Playwright reporter: writes the failed tests (with the first lines of each error) to the GitHub Actions
// job summary, so a failure can be read on the run page without opening the raw logs.
import { appendFileSync } from "node:fs";

const strip = (s) => String(s ?? "").replace(/\u001b\[[0-9;]*m/g, ""); // remove terminal colour codes
const head = (s, lines = 14, chars = 1400) => strip(s).split("\n").slice(0, lines).join("\n").slice(0, chars);

export default class SummaryReporter {
  onBegin(_config, suite) { this.suite = suite; }

  onEnd() {
    const file = process.env.GITHUB_STEP_SUMMARY;
    if (!file || !this.suite) return;
    const tests = this.suite.allTests();
    const count = (o) => tests.filter((t) => t.outcome() === o).length;
    const bad = tests.filter((t) => ["unexpected", "flaky"].includes(t.outcome()));
    const project = tests[0]?.parent?.project()?.name ?? "";
    let md = `### Playwright ${project}: ${count("expected")} passed, ${count("unexpected")} failed, ${count("flaky")} flaky, ${count("skipped")} skipped\n\n`;
    for (const t of bad.slice(0, 40)) {
      const last = t.results[t.results.length - 1];
      const error = last?.errors?.[0]?.message ?? last?.error?.message ?? "(no error message)";
      md += `<details><summary>${t.outcome() === "flaky" ? "flaky" : "FAILED"}: ${strip(t.titlePath().slice(2).join(" › "))}</summary>\n\n\`\`\`\n${head(error)}\n\`\`\`\n</details>\n\n`;
    }
    if (bad.length > 40) md += `…and ${bad.length - 40} more.\n`;
    try { appendFileSync(file, md); } catch {}
  }
}
