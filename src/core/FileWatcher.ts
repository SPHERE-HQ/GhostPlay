// src/core/FileWatcher.ts
// Integrasi Replit workflow — auto-run test setiap ada perubahan file

import * as fs from 'fs';
import * as path from 'path';
import { GhostPlay } from './GhostPlay.js';
import { Scenario } from '../types.js';

interface WatchOptions {
  dirs: string[];           // direktori yang dipantau, misal ['src', 'public']
  extensions?: string[];    // default: ['.ts', '.js', '.json', '.glsl', '.html']
  debounceMs?: number;      // default: 800ms
  clearConsole?: boolean;   // default: true
  maxRuns?: number;         // default: unlimited (0)
}

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', gray: '\x1b[90m', magenta: '\x1b[35m',
};

export class FileWatcher {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private watchers: fs.FSWatcher[] = [];
  private runCount = 0;
  private isRunning = false;
  private lastChangedFile = '';

  constructor(
    private ghostplayConfig: import('../types.js').GhostPlayConfig,
    private scenario: Scenario,
    private options: WatchOptions,
  ) {}

  start(): void {
    const exts = this.options.extensions ?? ['.ts', '.js', '.json', '.glsl', '.html', '.css'];
    const debounce = this.options.debounceMs ?? 800;
    const maxRuns = this.options.maxRuns ?? 0;

    console.log(`\n${C.bold}${C.magenta}[GhostPlay Watch]${C.reset} Mode aktif`);
    console.log(`${C.gray}  Scenario : ${this.scenario.name}${C.reset}`);
    console.log(`${C.gray}  URL      : ${this.ghostplayConfig.url}${C.reset}`);
    console.log(`${C.gray}  Pantau   : ${this.options.dirs.join(', ')}${C.reset}`);
    console.log(`${C.gray}  Ekstensi : ${exts.join(', ')}${C.reset}`);
    console.log(`${C.gray}  Debounce : ${debounce}ms${C.reset}`);
    console.log(`${C.gray}  Tekan Ctrl+C untuk berhenti${C.reset}\n`);

    for (const dir of this.options.dirs) {
      const absDir = path.resolve(process.cwd(), dir);
      if (!fs.existsSync(absDir)) {
        console.log(`${C.yellow}[WARN]${C.reset} Direktori tidak ditemukan, skip: ${absDir}`);
        continue;
      }

      const watcher = fs.watch(absDir, { recursive: true }, (event, filename) => {
        if (!filename) return;
        const ext = path.extname(filename);
        if (!exts.includes(ext)) return;

        this.lastChangedFile = `${dir}/${filename}`;

        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(async () => {
          if (this.isRunning) {
            console.log(`${C.yellow}[WATCH]${C.reset} Test masih berjalan, perubahan berikutnya diabaikan`);
            return;
          }
          if (maxRuns > 0 && this.runCount >= maxRuns) {
            console.log(`${C.gray}[WATCH]${C.reset} Batas maxRuns (${maxRuns}) tercapai, berhenti`);
            this.stop();
            return;
          }
          await this.runTest();
        }, debounce);
      });

      this.watchers.push(watcher);
    }

    // Jalankan sekali saat pertama start
    this.runTest();

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      console.log(`\n${C.gray}[WATCH]${C.reset} Berhenti. Total run: ${this.runCount}`);
      this.stop();
      process.exit(0);
    });
  }

  private async runTest(): Promise<void> {
    this.isRunning = true;
    this.runCount++;

    if (this.options.clearConsole !== false && this.runCount > 1) {
      process.stdout.write('\x1Bc');
    }

    const trigger = this.runCount === 1 ? 'start' : `perubahan: ${this.lastChangedFile}`;
    const ts = new Date().toLocaleTimeString('id-ID');
    console.log(`\n${C.magenta}[WATCH #${this.runCount}]${C.reset} ${ts} — ${trigger}`);

    try {
      const gp = new GhostPlay(this.ghostplayConfig);
      const report = await gp.run(this.scenario);

      const statusIcon = report.success ? `${C.green}✓ LULUS${C.reset}` : `${C.red}✗ GAGAL${C.reset}`;
      console.log(`\n${C.magenta}[WATCH]${C.reset} Hasil: ${statusIcon} (${report.passed} lulus, ${report.failed} gagal, ${report.totalMs}ms)`);
      console.log(`${C.gray}Menunggu perubahan file berikutnya...${C.reset}\n`);
    } catch (err: any) {
      console.log(`${C.red}[WATCH ERROR]${C.reset} ${err.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  stop(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    for (const w of this.watchers) w.close();
    this.watchers = [];
  }
}
