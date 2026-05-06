// src/core/GhostPlay.ts
import { chromium, Browser, Page } from 'playwright';
import { GhostPlayConfig, Scenario, Step, StepResult, TestReport, CapturedError } from '../types';
import { Reporter } from './Reporter';
import { InputSimulator } from './InputSimulator';
import { DOMChecker } from './DOMChecker';
import { ErrorCollector } from './ErrorCollector';
import { PerfMonitor } from './PerfMonitor';
import * as fs from 'fs';
import * as path from 'path';

export class GhostPlay {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private reporter: Reporter;
  private screenshotsDir: string;

  constructor(private config: GhostPlayConfig) {
    this.reporter = new Reporter(config);
    this.screenshotsDir = config.screenshotsDir ?? './ghostplay-screenshots';
  }

  async run(scenario: Scenario): Promise<TestReport> {
    this.reporter.start(scenario.name);

    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }

    this.browser = await chromium.launch({
      headless: this.config.headed !== true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const context = await this.browser.newContext({
      viewport:  this.config.viewport ?? { width: 390, height: 844 },
      hasTouch:  true,
      isMobile:  true,
      userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
    });

    this.page = await context.newPage();

    const errorCollector = new ErrorCollector(this.page, this.reporter);
    const perfMonitor    = new PerfMonitor(this.page);
    const input          = new InputSimulator(this.page, this.reporter);
    const dom            = new DOMChecker(this.page, this.reporter);

    await errorCollector.inject();
    await perfMonitor.inject();

    await this.page.goto(this.config.url, {
      waitUntil: 'domcontentloaded',
      timeout:   this.config.timeout ?? 30000,
    });

    this.reporter.info(`Halaman dimuat: ${this.config.url}`);

    const results: StepResult[] = [];

    for (const step of scenario.steps) {
      const result = await this.executeStep(step, input, dom, perfMonitor, errorCollector);
      results.push(result);
      this.reporter.step(result);
      if (result.status === 'fail' && scenario.stopOnFail !== false) {
        this.reporter.warn('Berhenti karena step gagal (stopOnFail=true)');
        break;
      }
    }

    const allErrors = await errorCollector.flush();
    await this.browser.close();

    return this.reporter.finish(results, allErrors);
  }

  private async executeStep(
    step: Step,
    input: InputSimulator,
    dom: DOMChecker,
    perf: PerfMonitor,
    errors: ErrorCollector,
  ): Promise<StepResult> {
    const t0 = Date.now();
    const make = (status: StepResult['status'], message: string, extra?: Partial<StepResult>): StepResult => ({
      step, status, message, durationMs: Date.now() - t0, ...extra,
    });

    try {
      switch (step.type) {

        case 'wait':
          await this.page!.waitForTimeout(step.ms);
          return make('ok', `Menunggu ${step.ms}ms`);

        case 'wait-for': {
          const timeout = step.timeout ?? 10000;
          try {
            await this.page!.waitForSelector(step.selector, { timeout, state: 'visible' });
            return make('ok', `"${step.selector}" muncul`);
          } catch {
            return make('fail', `"${step.selector}" tidak muncul dalam ${timeout}ms`);
          }
        }

        case 'tap':
          if (step.selector) {
            const el = await this.page!.$(step.selector);
            if (!el) return make('fail', `Elemen "${step.selector}" tidak ditemukan`);
            await input.tap(step.selector);
            return make('ok', `Tap "${step.selector}"`);
          } else if (step.x !== undefined && step.y !== undefined) {
            await input.tap(undefined, step.x, step.y);
            return make('ok', `Tap (${step.x}, ${step.y})`);
          }
          return make('fail', 'tap: butuh selector atau x,y');

        case 'tap-text': {
          const ok = await input.tapText(step.text);
          return ok
            ? make('ok', `Tap teks "${step.text}"`)
            : make('fail', `Teks "${step.text}" tidak ditemukan di layar`);
        }

        case 'swipe':
          await input.swipe(step.x1, step.y1, step.x2, step.y2, step.duration);
          return make('ok', `Swipe (${step.x1},${step.y1})→(${step.x2},${step.y2})`);

        case 'type':
          await input.type(step.selector, step.text);
          return make('ok', `Ketik "${step.text}" ke "${step.selector}"`);

        case 'key':
          await input.key(step.key);
          return make('ok', `Key "${step.key}"`);

        case 'scroll':
          await input.scroll(step.x ?? 0, step.y ?? 100, step.selector);
          return make('ok', `Scroll`);

        case 'check-element': {
          const exists = step.exists !== false;
          const result = exists
            ? await dom.visible(step.selector)
            : await dom.exists(step.selector);
          return make(result.ok === exists ? 'ok' : 'fail', result.message);
        }

        case 'check-text': {
          const result = await dom.containsText(step.selector, step.contains);
          return make(result.ok ? 'ok' : 'fail', result.message);
        }

        case 'check-fps': {
          const duration = step.duration ?? 2000;
          const fps = await perf.measure(duration);
          const ok = fps.avg >= step.min;
          const msg = `FPS rata-rata ${fps.avg} (min ${fps.min}, current ${fps.current}) — batas minimal ${step.min}`;
          return make(ok ? 'ok' : 'warn', msg);
        }

        case 'check-no-errors': {
          const errs = errors.getErrors();
          if (errs.length === 0) return make('ok', 'Tidak ada JS error');
          const summary = errs.map(e => `${e.message} (${e.source}:${e.line})`).join('\n');
          return make('fail', `Ditemukan ${errs.length} JS error`, { error: summary });
        }

        case 'screenshot': {
          const filename = `${step.label.replace(/[^a-z0-9_-]/gi, '_')}.png`;
          const filepath = path.join(this.screenshotsDir, filename);
          await this.page!.screenshot({ path: filepath, fullPage: false });
          return make('ok', `Screenshot disimpan`, { screenshotPath: filepath });
        }

        case 'log':
          this.reporter.info(step.message);
          return make('info', step.message);

        default:
          return make('skip', `Step type tidak dikenal: ${(step as any).type}`);
      }
    } catch (err: any) {
      return make('fail', `Error saat eksekusi step`, { error: err?.message ?? String(err) });
    }
  }
}
