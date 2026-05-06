// src/core/GhostPlay.ts
import { chromium, Browser, Page } from 'playwright';
import { GhostPlayConfig, Scenario, Step, StepResult, TestReport, CapturedError } from '../types.js';
import { Reporter } from './Reporter.js';
import { InputSimulator } from './InputSimulator.js';
import { DOMChecker } from './DOMChecker.js';
import { ErrorCollector } from './ErrorCollector.js';
import { PerfMonitor } from './PerfMonitor.js';
import { BabylonChecker } from './BabylonChecker.js';
import { BlueprintChecker } from './BlueprintChecker.js';
import { AssetChecker } from './AssetChecker.js';
import * as fs from 'fs';
import * as path from 'path';

export interface GhostPlayRunConfig extends GhostPlayConfig {
  jsonMode?: boolean;
}

export class GhostPlay {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private reporter: Reporter;
  private screenshotsDir: string;

  constructor(private config: GhostPlayRunConfig) {
    this.reporter = new Reporter(config, { json: config.jsonMode });
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
    const babylon        = new BabylonChecker(this.page, this.reporter);
    const blueprint      = new BlueprintChecker(this.page, this.reporter);
    const assets         = new AssetChecker(this.page, this.reporter);

    await errorCollector.inject();
    await perfMonitor.inject();

    await this.page.goto(this.config.url, {
      waitUntil: 'domcontentloaded',
      timeout:   this.config.timeout ?? 30000,
    });

    this.reporter.info(`Page loaded: ${this.config.url}`);

    const results: StepResult[] = [];

    for (const step of scenario.steps) {
      const result = await this.executeStep(
        step, input, dom, perfMonitor, errorCollector, babylon, blueprint, assets,
      );
      results.push(result);
      this.reporter.step(result);
      if (result.status === 'fail' && scenario.stopOnFail === true) {
        this.reporter.warn('Stopping: step failed and stopOnFail=true');
        break;
      }
    }

    const allErrors = await errorCollector.flush();
    await this.browser.close();

    return this.reporter.finish(results, allErrors);
  }

  private async executeStep(
    step:      Step,
    input:     InputSimulator,
    dom:       DOMChecker,
    perf:      PerfMonitor,
    errors:    ErrorCollector,
    babylon:   BabylonChecker,
    blueprint: BlueprintChecker,
    assets:    AssetChecker,
  ): Promise<StepResult> {
    const t0   = Date.now();
    const make = (status: StepResult['status'], message: string, extra?: Partial<StepResult>): StepResult => ({
      step, status, message, durationMs: Date.now() - t0, ...extra,
    });

    try {
      switch (step.type) {

        case 'wait':
          await this.page!.waitForTimeout(step.ms);
          return make('ok', `Waited ${step.ms}ms`);

        case 'wait-for': {
          const timeout = step.timeout ?? 10000;
          try {
            await this.page!.waitForSelector(step.selector, { timeout, state: 'visible' });
            return make('ok', `"${step.selector}" appeared`);
          } catch {
            return make('fail', `"${step.selector}" did not appear within ${timeout}ms`);
          }
        }

        case 'tap':
          if (step.selector) {
            const el = await this.page!.$(step.selector);
            if (!el) return make('fail', `Element "${step.selector}" not found`);
            await input.tap(step.selector);
            return make('ok', `Tapped "${step.selector}"`);
          } else if (step.x !== undefined && step.y !== undefined) {
            await input.tap(undefined, step.x, step.y);
            return make('ok', `Tapped (${step.x}, ${step.y})`);
          }
          return make('fail', 'tap: requires selector or x,y coordinates');

        case 'tap-text': {
          const ok = await input.tapText(step.text);
          return ok
            ? make('ok',   `Tapped text "${step.text}"`)
            : make('fail', `Text "${step.text}" not found on screen`);
        }

        case 'swipe':
          await input.swipe(step.x1, step.y1, step.x2, step.y2, step.duration);
          return make('ok', `Swiped (${step.x1},${step.y1})→(${step.x2},${step.y2})`);

        case 'type':
          await input.type(step.selector, step.text);
          return make('ok', `Typed "${step.text}" into "${step.selector}"`);

        case 'key':
          await input.key(step.key);
          return make('ok', `Key "${step.key}"`);

        case 'scroll':
          await input.scroll(step.x ?? 0, step.y ?? 100, step.selector);
          return make('ok', `Scrolled`);

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
          const ok  = fps.avg >= step.min;
          return make(
            ok ? 'ok' : 'warn',
            `FPS avg ${fps.avg} (min ${fps.min}, current ${fps.current}) — threshold ${step.min}`,
          );
        }

        case 'check-no-errors': {
          const errs = errors.getErrors();
          if (errs.length === 0) return make('ok', 'No JS errors');
          const summary = errs.map(e => `${e.message} (${e.source}:${e.line})`).join('\n');
          return make('fail', `${errs.length} JS error(s) found`, { error: summary });
        }

        case 'check-canvas-babylon': {
          const checks     = step.checks ?? {};
          const result     = await babylon.check(checks);
          const webglResult = await babylon.isWebGLRendering();
          const status     = result.ok && webglResult.ok ? 'ok' : result.ok ? 'warn' : 'fail';
          return make(status, `${result.message} | WebGL: ${webglResult.message}`, { detail: result.report });
        }

        case 'check-blueprint': {
          const report = await blueprint.validate(step.blueprint);
          const status = report.failed > 0 ? 'fail' : report.warned > 0 ? 'warn' : 'ok';
          return make(status,
            `Blueprint "${report.blueprintName}": ${report.passed} pass, ${report.failed} fail, ${report.warned} warn`,
            { detail: report },
          );
        }

        case 'check-assets': {
          let spec = step.assets;
          if (typeof spec === 'string') {
            const { default: fs2 } = await import('fs');
            const { default: path2 } = await import('path');
            const absPath = path2.resolve(process.cwd(), spec);
            const parsed  = JSON.parse(fs2.readFileSync(absPath, 'utf-8'));
            // Blueprint file — ekstrak bagian assets-nya
            spec = parsed.assets ?? parsed;
          }
          const report = await assets.validate(spec as import('../types.js').AssetsSpec);
          const status = report.failed > 0 ? 'fail' : report.warned > 0 ? 'warn' : 'ok';
          return make(status,
            `Assets: ${report.passed} ok, ${report.failed} missing/wrong, ${report.warned} warnings`,
            { detail: report },
          );
        }

        case 'screenshot': {
          const filename = `${step.label.replace(/[^a-z0-9_-]/gi, '_')}.png`;
          const filepath = path.join(this.screenshotsDir, filename);
          await this.page!.screenshot({ path: filepath, fullPage: false });
          return make('ok', `Screenshot saved`, { screenshotPath: filepath });
        }

        case 'log':
          this.reporter.info(step.message);
          return make('info', step.message);

        default:
          return make('skip', `Unknown step type: ${(step as any).type}`);
      }
    } catch (err: any) {
      return make('fail', `Step execution error`, { error: err?.message ?? String(err) });
    }
  }
}
