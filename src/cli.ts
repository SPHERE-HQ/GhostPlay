// src/cli.ts
import { GhostPlay } from './core/GhostPlay';
import * as path from 'path';
import * as url from 'url';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    console.log(`
GhostPlay — Game Test Runner untuk AI Agent
─────────────────────────────────────────────
Cara pakai:
  ghostplay run <scenario.ts> [opsi]

Opsi:
  --url <url>         URL game yang mau ditest (override dari scenario)
  --headed            Tampilkan browser (default: headless)
  --width <px>        Viewport width (default: 390)
  --height <px>       Viewport height (default: 844)
  --screenshots <dir> Folder output screenshot (default: ./ghostplay-screenshots)
  --timeout <ms>      Timeout page load (default: 30000)

Contoh:
  ghostplay run scenarios/forge-frenzy.ts
  ghostplay run scenarios/forge-frenzy.ts --url http://localhost:5173 --headed
    `);
    process.exit(0);
  }

  if (args[0] !== 'run') {
    console.error(`Perintah tidak dikenal: ${args[0]}. Gunakan: ghostplay run <scenario>`);
    process.exit(1);
  }

  const scenarioPath = args[1];
  if (!scenarioPath) {
    console.error('Butuh path scenario: ghostplay run <scenario.ts>');
    process.exit(1);
  }

  // Parse opsi
  const getArg = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };
  const hasFlag = (flag: string) => args.includes(flag);

  const overrideUrl    = getArg('--url');
  const headed         = hasFlag('--headed');
  const width          = parseInt(getArg('--width') ?? '390');
  const height         = parseInt(getArg('--height') ?? '844');
  const screenshotsDir = getArg('--screenshots') ?? './ghostplay-screenshots';
  const timeout        = parseInt(getArg('--timeout') ?? '30000');

  // Load scenario file
  const absPath = path.resolve(process.cwd(), scenarioPath);
  let scenarioModule: any;
  try {
    scenarioModule = await import(url.pathToFileURL(absPath).href);
  } catch (err: any) {
    console.error(`Gagal load scenario: ${absPath}\n${err.message}`);
    process.exit(1);
  }

  const scenario = scenarioModule.default ?? scenarioModule.scenario;
  if (!scenario || !scenario.steps) {
    console.error('Scenario harus export default { name, steps: [...] }');
    process.exit(1);
  }

  const config = {
    url:            overrideUrl ?? scenario.url ?? 'http://localhost:5173',
    headed,
    viewport:       { width, height },
    screenshotsDir,
    timeout,
  };

  const ghostplay = new GhostPlay(config);
  const report = await ghostplay.run(scenario);

  process.exit(report.success ? 0 : 1);
}

main().catch(err => {
  console.error('GhostPlay crash:', err);
  process.exit(1);
});
