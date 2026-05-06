// src/cli.ts
import { GhostPlay } from './core/GhostPlay.js';
import { FileWatcher } from './core/FileWatcher.js';
import { Scenario } from './types.js';
import * as path from 'path';
import * as fs from 'fs';
import * as url from 'url';

const HELP = `
GhostPlay — Browser Game Test Runner for AI Agents
────────────────────────────────────────────────────────────
Commands:
  ghostplay run   <scenario>  [options]   Run test once
  ghostplay watch <scenario>  [options]   Auto-run on file changes

Options:
  --url <url>            Game URL to test
  --headed               Show browser window (default: headless)
  --width <px>           Viewport width  (default: 390)
  --height <px>          Viewport height (default: 844)
  --screenshots <dir>    Screenshot output folder (default: ./ghostplay-screenshots)
  --timeout <ms>         Page load timeout (default: 30000)
  --json                 Output results as JSON (machine-readable, for AI agents)
  --no-screenshots       Skip screenshots (faster for CI/agent runs)

Watch options:
  --watch-dir <dir>      Directory to watch (repeatable)
  --debounce <ms>        Debounce delay after change (default: 800)
  --no-clear             Don't clear terminal on re-run

Scenario formats:
  .ts    TypeScript scenario (defineScenario)
  .json  JSON scenario (no TypeScript required)

Examples:
  ghostplay run  scenarios/example.ts --json
  ghostplay run  scenarios/example.json --url http://localhost:5173
  ghostplay watch scenarios/example.ts --watch-dir src --watch-dir public
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(HELP);
    process.exit(0);
  }

  const command = args[0];
  if (command !== 'run' && command !== 'watch') {
    console.error(`Unknown command: "${command}". Use: ghostplay run <scenario> or ghostplay watch <scenario>`);
    process.exit(1);
  }

  const scenarioPath = args[1];
  if (!scenarioPath) {
    console.error(`Scenario path required: ghostplay ${command} <scenario.ts|scenario.json>`);
    process.exit(1);
  }

  // ── Parse options ────────────────────────────────────────────────────────
  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };
  const getAllArgs = (flag: string): string[] => {
    const result: string[] = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === flag && args[i + 1]) result.push(args[i + 1]);
    }
    return result;
  };
  const hasFlag = (flag: string) => args.includes(flag);

  const overrideUrl     = getArg('--url');
  const headed          = hasFlag('--headed');
  const jsonMode        = hasFlag('--json');
  const noScreenshots   = hasFlag('--no-screenshots');
  const width           = parseInt(getArg('--width')    ?? '390');
  const height          = parseInt(getArg('--height')   ?? '844');
  const screenshotsDir  = noScreenshots ? undefined : (getArg('--screenshots') ?? './ghostplay-screenshots');
  const timeout         = parseInt(getArg('--timeout')  ?? '30000');
  const debounce        = parseInt(getArg('--debounce') ?? '800');
  const noClear         = hasFlag('--no-clear');
  const watchDirs       = getAllArgs('--watch-dir');

  // ── Load scenario ─────────────────────────────────────────────────────────
  const absPath = path.resolve(process.cwd(), scenarioPath);
  if (!fs.existsSync(absPath)) {
    const err = { error: 'scenario_not_found', path: absPath };
    if (jsonMode) { process.stdout.write(JSON.stringify(err) + '\n'); }
    else { console.error(`Scenario file not found: ${absPath}`); }
    process.exit(1);
  }

  let scenario: Scenario;
  const ext = path.extname(absPath).toLowerCase();

  if (ext === '.json') {
    try {
      scenario = JSON.parse(fs.readFileSync(absPath, 'utf-8')) as Scenario;
    } catch (err: any) {
      const out = { error: 'json_parse_failed', message: err.message };
      if (jsonMode) { process.stdout.write(JSON.stringify(out) + '\n'); }
      else { console.error(`Failed to parse JSON scenario: ${err.message}`); }
      process.exit(1);
    }
  } else {
    try {
      const mod = await import(url.pathToFileURL(absPath).href);
      scenario = mod.default ?? mod.scenario;
    } catch (err: any) {
      const out = { error: 'scenario_load_failed', message: err.message };
      if (jsonMode) { process.stdout.write(JSON.stringify(out) + '\n'); }
      else { console.error(`Failed to load scenario: ${err.message}`); }
      process.exit(1);
    }
  }

  if (!scenario || !Array.isArray(scenario.steps)) {
    const out = { error: 'invalid_scenario', message: 'Scenario must have a "steps" array' };
    if (jsonMode) { process.stdout.write(JSON.stringify(out) + '\n'); }
    else { console.error(out.message); }
    process.exit(1);
  }

  const config = {
    url:            overrideUrl ?? scenario.url ?? 'http://localhost:5173',
    headed,
    viewport:       { width, height },
    screenshotsDir: screenshotsDir ?? './ghostplay-screenshots',
    timeout,
    jsonMode,
  };

  // ── Execute ───────────────────────────────────────────────────────────────
  if (command === 'run') {
    const gp     = new GhostPlay(config);
    const report = await gp.run(scenario);
    process.exit(report.success ? 0 : 1);

  } else {
    const dirsToWatch = watchDirs.length > 0 ? watchDirs : ['src', 'public'];
    const watcher = new FileWatcher(config, scenario, {
      dirs:         dirsToWatch,
      debounceMs:   debounce,
      clearConsole: !noClear,
    });
    watcher.start();
  }
}

main().catch(err => {
  const out = { error: 'ghostplay_crash', message: err.message, stack: err.stack };
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify(out) + '\n');
  } else {
    console.error('GhostPlay crashed:', err);
  }
  process.exit(1);
});
