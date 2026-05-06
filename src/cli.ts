// src/cli.ts
import { GhostPlay } from './core/GhostPlay.js';
import { FileWatcher } from './core/FileWatcher.js';
import { Scenario } from './types.js';
import * as path from 'path';
import * as fs from 'fs';
import * as url from 'url';

const HELP = `
GhostPlay — Game Test Runner untuk AI Agent
─────────────────────────────────────────────────────────────
Perintah:
  ghostplay run   <scenario>  [opsi]    Jalankan test sekali
  ghostplay watch <scenario>  [opsi]    Auto-run saat file berubah

Opsi umum:
  --url <url>            URL game yang mau ditest
  --headed               Tampilkan browser (default: headless)
  --width <px>           Viewport width  (default: 390)
  --height <px>          Viewport height (default: 844)
  --screenshots <dir>    Folder output screenshot (default: ./ghostplay-screenshots)
  --timeout <ms>         Timeout page load (default: 30000)

Opsi watch:
  --watch-dir <dir>      Direktori yang dipantau (bisa diulang beberapa kali)
                         Default: src,public
  --debounce <ms>        Jeda sebelum re-run setelah perubahan (default: 800)
  --no-clear             Jangan clear terminal saat re-run

Scenario:
  Bisa .ts (TypeScript) atau .json (JSON scenario)

Contoh:
  ghostplay run  scenarios/forge-frenzy.ts
  ghostplay run  scenarios/my-game.json --url http://localhost:5173 --headed
  ghostplay watch scenarios/forge-frenzy.ts --watch-dir src --watch-dir public
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(HELP);
    process.exit(0);
  }

  const command = args[0];
  if (command !== 'run' && command !== 'watch') {
    console.error(`Perintah tidak dikenal: "${command}". Gunakan: ghostplay run <scenario> atau ghostplay watch <scenario>`);
    process.exit(1);
  }

  const scenarioPath = args[1];
  if (!scenarioPath) {
    console.error(`Butuh path scenario: ghostplay ${command} <scenario.ts|scenario.json>`);
    process.exit(1);
  }

  // ── Parse opsi ──────────────────────────────────────────────────────────
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

  const overrideUrl    = getArg('--url');
  const headed         = hasFlag('--headed');
  const width          = parseInt(getArg('--width')  ?? '390');
  const height         = parseInt(getArg('--height') ?? '844');
  const screenshotsDir = getArg('--screenshots') ?? './ghostplay-screenshots';
  const timeout        = parseInt(getArg('--timeout') ?? '30000');
  const debounce       = parseInt(getArg('--debounce') ?? '800');
  const noClear        = hasFlag('--no-clear');
  const watchDirs      = getAllArgs('--watch-dir');

  // ── Load scenario ────────────────────────────────────────────────────────
  const absPath = path.resolve(process.cwd(), scenarioPath);
  if (!fs.existsSync(absPath)) {
    console.error(`File scenario tidak ditemukan: ${absPath}`);
    process.exit(1);
  }

  let scenario: Scenario;
  const ext = path.extname(absPath).toLowerCase();

  if (ext === '.json') {
    // JSON scenario
    try {
      const raw = fs.readFileSync(absPath, 'utf-8');
      scenario = JSON.parse(raw) as Scenario;
    } catch (err: any) {
      console.error(`Gagal parse JSON scenario: ${absPath}\n${err.message}`);
      process.exit(1);
    }
  } else {
    // TypeScript / JS scenario
    try {
      const mod = await import(url.pathToFileURL(absPath).href);
      scenario = mod.default ?? mod.scenario;
    } catch (err: any) {
      console.error(`Gagal load scenario: ${absPath}\n${err.message}`);
      process.exit(1);
    }
  }

  if (!scenario || !scenario.steps || !Array.isArray(scenario.steps)) {
    console.error('Scenario harus punya field "steps" berupa array');
    process.exit(1);
  }

  const config = {
    url:            overrideUrl ?? scenario.url ?? 'http://localhost:5173',
    headed,
    viewport:       { width, height },
    screenshotsDir,
    timeout,
  };

  // ── Jalankan ─────────────────────────────────────────────────────────────
  if (command === 'run') {
    const gp = new GhostPlay(config);
    const report = await gp.run(scenario);
    process.exit(report.success ? 0 : 1);

  } else {
    // watch mode
    const dirsToWatch = watchDirs.length > 0 ? watchDirs : ['src', 'public'];
    const watcher = new FileWatcher(config, scenario, {
      dirs: dirsToWatch,
      debounceMs: debounce,
      clearConsole: !noClear,
    });
    watcher.start();
  }
}

main().catch(err => {
  console.error('GhostPlay crash:', err);
  process.exit(1);
});
