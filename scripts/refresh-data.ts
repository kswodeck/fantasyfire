// One-shot "make my data current" runner: applies migrations, then runs every
// ingest in dependency order (schedule → per-sport stats → injuries → book lines,
// so line ingestion can name-match freshly-created players).
//
//   pnpm data:refresh            — local dev database (.env)
//   pnpm data:refresh:prod       — production database (.env.prod.local)
//   pnpm data:refresh --dry-run  — print the plan without running anything
//
// Required steps abort the run on failure (a broken schema helps nobody); the
// ingests are BEST-EFFORT — an off-season sport or a flaky upstream API logs a
// warning and the rest still run, with a summary (and non-zero exit) at the end.
import { spawnSync } from 'node:child_process';

const PROD = process.argv.includes('--prod');
const DRY = process.argv.includes('--dry-run');

const STEPS: Array<{ label: string; script: string; required?: boolean }> = [
  { label: 'database migrations', script: 'db:deploy', required: true },
  { label: 'game schedule', script: 'schedule', required: true },
  { label: 'NBA game logs', script: 'ingest' },
  { label: 'MLB game logs', script: 'ingest:mlb' },
  { label: 'NFL game logs', script: 'ingest:nfl' },
  { label: 'injury report', script: 'ingest:injuries' },
  { label: 'book lines (PrizePicks/Underdog/…)', script: 'ingest:providedlines' },
];

function run(script: string): boolean {
  const target = PROD ? `${script}:prod` : script;
  if (DRY) {
    console.log(`[data:refresh] would run: pnpm ${target}`);
    return true;
  }
  console.log(`\n[data:refresh] ▶ pnpm ${target}`);
  // shell:true so the pnpm shim resolves on Windows too.
  const res = spawnSync('pnpm', ['run', target], { stdio: 'inherit', shell: true });
  return res.status === 0;
}

const failed: string[] = [];
for (const step of STEPS) {
  const ok = run(step.script);
  if (ok) continue;
  if (step.required) {
    console.error(`\n[data:refresh] ✖ required step "${step.label}" failed — stopping.`);
    process.exit(1);
  }
  console.warn(`[data:refresh] ⚠ "${step.label}" failed — continuing (off-season / upstream blip?).`);
  failed.push(step.label);
}

if (DRY) {
  console.log(`\n[data:refresh] dry run complete — nothing was executed.`);
} else if (failed.length > 0) {
  console.warn(`\n[data:refresh] done with ${failed.length} skipped step(s): ${failed.join(', ')}.`);
  process.exitCode = 1;
} else {
  console.log(`\n[data:refresh] done — schedule, stats, injuries, and lines are current.`);
}
