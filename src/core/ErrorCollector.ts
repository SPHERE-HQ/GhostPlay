// src/core/ErrorCollector.ts
import { Page } from 'playwright';
import { CapturedError } from '../types';
import { Reporter } from './Reporter';

export class ErrorCollector {
  private errors: CapturedError[] = [];

  constructor(private page: Page, private reporter: Reporter) {}

  async inject(): Promise<void> {
    // Tangkap semua error JS sebelum game load
    await this.page.addInitScript(() => {
      (window as any).__ghostplay_errors = [];

      // Override console.error
      const _consoleError = console.error.bind(console);
      console.error = (...args: any[]) => {
        (window as any).__ghostplay_errors.push({
          message: args.map(String).join(' '),
          source:  'console.error',
          line: 0, col: 0,
          stack: new Error().stack ?? '',
          timestamp: Date.now(),
        });
        _consoleError(...args);
      };

      // Tangkap uncaught JS errors
      window.addEventListener('error', (e) => {
        (window as any).__ghostplay_errors.push({
          message: e.message,
          source:  e.filename ?? 'unknown',
          line:    e.lineno ?? 0,
          col:     e.colno ?? 0,
          stack:   e.error?.stack ?? '',
          timestamp: Date.now(),
        });
      });

      // Tangkap unhandled promise rejections
      window.addEventListener('unhandledrejection', (e) => {
        const err = e.reason;
        (window as any).__ghostplay_errors.push({
          message: err?.message ?? String(err),
          source:  'UnhandledRejection',
          line: 0, col: 0,
          stack: err?.stack ?? '',
          timestamp: Date.now(),
        });
      });
    });

    // Mirror page console ke terminal agent secara real-time
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        this.reporter.error(`[PAGE] ${text}`);
        this.errors.push({
          message: text,
          source: 'console.error',
          line: 0, col: 0,
          stack: '',
          timestamp: Date.now(),
        });
      }
    });

    this.page.on('pageerror', err => {
      this.reporter.error(`[CRASH] ${err.message}`, undefined, undefined, err.stack);
      this.errors.push({
        message: err.message,
        source:  'pageerror',
        line: 0, col: 0,
        stack: err.stack ?? '',
        timestamp: Date.now(),
      });
    });
  }

  async flush(): Promise<CapturedError[]> {
    // Ambil error yang dikumpulkan dari dalam page
    const pageErrors = await this.page.evaluate(() =>
      (window as any).__ghostplay_errors ?? []
    );
    // Merge dengan yang sudah ditangkap via event
    const all = [...this.errors];
    for (const e of pageErrors) {
      if (!all.find(x => x.message === e.message && x.timestamp === e.timestamp)) {
        all.push(e);
      }
    }
    return all;
  }

  getErrors(): CapturedError[] {
    return this.errors;
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }
}
