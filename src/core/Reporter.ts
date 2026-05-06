// src/core/Reporter.ts
import { StepResult, TestReport, GhostPlayConfig, CapturedError } from '../types.js';

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
  white:  '\x1b[97m',
};

function ts(): string {
  const d = new Date();
  const m  = String(d.getMinutes()).padStart(2, '0');
  const s  = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${m}:${s}.${ms}`;
}

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

export class Reporter {
  private startTime = Date.now();
  private jsonMode:  boolean;
  private scenarioName = '';

  // Buffer untuk JSON mode — kumpulkan semua log dulu, print di akhir
  private jsonSteps: Array<{
    time: string;
    label: string;
    status: string;
    message: string;
    durationMs: number;
    error?: string;
    screenshotPath?: string;
  }> = [];
  private jsonInfos: string[] = [];

  constructor(private config: GhostPlayConfig, opts?: { json?: boolean }) {
    this.jsonMode = opts?.json ?? false;
  }

  setJsonMode(enabled: boolean): void {
    this.jsonMode = enabled;
  }

  start(name: string): void {
    this.startTime = Date.now();
    this.scenarioName = name;
    if (this.jsonMode) return; // JSON mode: tidak print header

    this.line();
    this.print(`${C.bold}${C.cyan}[GhostPlay]${C.reset} ${C.white}${name}${C.reset}`);
    this.print(`${C.gray}  URL: ${this.config.url}${C.reset}`);
    this.print(`${C.gray}  Viewport: ${this.config.viewport?.width ?? 390}x${this.config.viewport?.height ?? 844}${C.reset}`);
    this.line();
  }

  step(result: StepResult): void {
    const label = this.stepLabel(result.step);

    if (this.jsonMode) {
      this.jsonSteps.push({
        time:           ts(),
        label:          result.step.label ?? label,
        status:         result.status,
        message:        result.message,
        durationMs:     result.durationMs,
        ...(result.error          && { error:          result.error }),
        ...(result.screenshotPath && { screenshotPath: result.screenshotPath }),
      });
      return;
    }

    const icon = {
      ok:   `${C.green}✓${C.reset}`,
      fail: `${C.red}✗${C.reset}`,
      warn: `${C.yellow}⚠${C.reset}`,
      skip: `${C.gray}−${C.reset}`,
      info: `${C.cyan}ℹ${C.reset}`,
    }[result.status];

    const dur = result.durationMs > 0 ? `${C.gray} (${result.durationMs}ms)${C.reset}` : '';
    const msg = result.message !== label ? `  ${C.dim}${result.message}${C.reset}` : '';
    this.print(`${C.gray}[${ts()}]${C.reset} ${icon} ${label}${dur}${msg}`);

    if (result.error) {
      result.error.split('\n').forEach(line => {
        this.print(`${C.red}         ${line}${C.reset}`);
      });
    }
    if (result.screenshotPath) {
      this.print(`${C.gray}         📸 ${result.screenshotPath}${C.reset}`);
    }
  }

  error(msg: string, source?: string, line?: number, stack?: string): void {
    if (this.jsonMode) { this.jsonInfos.push(`ERROR: ${msg}`); return; }
    this.print(`${C.gray}[${ts()}]${C.reset} ${C.red}[ERR]${C.reset} ${msg}`);
    if (source) this.print(`${C.red}         at ${source}:${line ?? '?'}${C.reset}`);
    if (stack)  stack.split('\n').slice(0, 4).forEach(l => this.print(`${C.red}         ${l.trim()}${C.reset}`));
  }

  warn(msg: string): void {
    if (this.jsonMode) { this.jsonInfos.push(`WARN: ${msg}`); return; }
    this.print(`${C.gray}[${ts()}]${C.reset} ${C.yellow}[WARN]${C.reset} ${msg}`);
  }

  info(msg: string): void {
    if (this.jsonMode) { this.jsonInfos.push(`INFO: ${msg}`); return; }
    this.print(`${C.gray}[${ts()}]${C.reset} ${C.cyan}[INFO]${C.reset} ${msg}`);
  }

  finish(results: StepResult[], errors: CapturedError[]): TestReport {
    const passed  = results.filter(r => r.status === 'ok').length;
    const failed  = results.filter(r => r.status === 'fail').length;
    const warned  = results.filter(r => r.status === 'warn').length;
    const totalMs = Date.now() - this.startTime;
    const success = failed === 0;

    const report: TestReport = {
      scenario: this.scenarioName,
      passed, failed, warned, totalMs,
      results, errors, success,
    };

    if (this.jsonMode) {
      // Agent-friendly: satu JSON object di stdout, machine-parseable
      const agentOutput = {
        scenario:  this.scenarioName,
        url:       this.config.url,
        success,
        summary:   { passed, failed, warned, totalMs },
        steps:     this.jsonSteps,
        jsErrors:  errors.map(e => ({ message: e.message, source: e.source, line: e.line, stack: e.stack })),
        logs:      this.jsonInfos,
      };
      process.stdout.write(JSON.stringify(agentOutput, null, 2) + '\n');
      return report;
    }

    // Human-readable terminal output
    this.line();
    this.print(`${C.bold}Results:${C.reset}`);
    this.print(`  ${C.green}✓ Passed${C.reset}   ${passed}`);
    if (warned > 0) this.print(`  ${C.yellow}⚠ Warned${C.reset}   ${warned}`);
    if (failed > 0) this.print(`  ${C.red}✗ Failed${C.reset}   ${failed}`);
    if (errors.length > 0) this.print(`  ${C.red}⚡ JS Errors${C.reset} ${errors.length}`);
    this.print(`  ${C.gray}⏱ Total${C.reset}    ${totalMs}ms`);
    this.line();

    if (success) {
      this.print(`${C.green}${C.bold}  SEMUA TEST LULUS ✓${C.reset}`);
    } else {
      this.print(`${C.red}${C.bold}  ADA ${failed} TEST GAGAL ✗${C.reset}`);
    }
    this.line();

    return report;
  }

  private stepLabel(step: any): string {
    if (step.label) return step.label;
    switch (step.type) {
      case 'wait':              return `wait ${step.ms}ms`;
      case 'wait-for':          return `wait-for "${step.selector}"`;
      case 'tap':               return step.selector ? `tap "${step.selector}"` : `tap (${step.x},${step.y})`;
      case 'tap-text':          return `tap-text "${step.text}"`;
      case 'swipe':             return `swipe (${step.x1},${step.y1})→(${step.x2},${step.y2})`;
      case 'type':              return `type "${step.text}" into "${step.selector}"`;
      case 'key':               return `key "${step.key}"`;
      case 'check-element':     return `check "${step.selector}" exists`;
      case 'check-text':        return `check "${step.selector}" contains "${step.contains}"`;
      case 'check-fps':         return `check FPS ≥ ${step.min}`;
      case 'check-no-errors':   return `check no JS errors`;
      case 'check-canvas-babylon': return `check Babylon.js engine`;
      case 'check-blueprint':   return `check blueprint`;
      case 'check-assets':      return `check assets`;
      case 'screenshot':        return `screenshot "${step.label}"`;
      default:                  return step.type;
    }
  }

  private print(msg: string): void {
    console.log(msg);
  }

  private line(): void {
    this.print(`${C.gray}${'─'.repeat(60)}${C.reset}`);
  }
}
