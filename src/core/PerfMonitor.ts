// src/core/PerfMonitor.ts
import { Page } from 'playwright';

export class PerfMonitor {
  constructor(private page: Page) {}

  async inject(): Promise<void> {
    await this.page.addInitScript(() => {
      (window as any).__ghostplay_fps = {
        current: 0,
        avg: 0,
        min: Infinity,
        samples: [] as number[],
      };

      let lastTime = performance.now();
      let frames = 0;

      function tick() {
        frames++;
        const now = performance.now();
        const delta = now - lastTime;

        if (delta >= 500) {
          const fps = Math.round((frames / delta) * 1000);
          const data = (window as any).__ghostplay_fps;
          data.current = fps;
          data.samples.push(fps);
          if (data.samples.length > 20) data.samples.shift();
          data.avg = Math.round(
            data.samples.reduce((a: number, b: number) => a + b, 0) / data.samples.length
          );
          data.min = Math.min(data.min, fps);
          frames = 0;
          lastTime = now;
        }

        requestAnimationFrame(tick);
      }

      requestAnimationFrame(tick);
    });
  }

  async measure(durationMs = 2000): Promise<{ current: number; avg: number; min: number }> {
    await this.page.waitForTimeout(durationMs);
    return this.page.evaluate(() => {
      const d = (window as any).__ghostplay_fps;
      return { current: d?.current ?? 0, avg: d?.avg ?? 0, min: d?.min ?? 0 };
    });
  }

  async getCurrent(): Promise<number> {
    return this.page.evaluate(() => (window as any).__ghostplay_fps?.current ?? 0);
  }
}
