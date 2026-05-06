// src/core/InputSimulator.ts
import { Page } from 'playwright';
import { Reporter } from './Reporter';

export class InputSimulator {
  constructor(private page: Page, private reporter: Reporter) {}

  async tap(selector?: string, x?: number, y?: number): Promise<void> {
    if (selector) {
      await this.page.tap(selector, { timeout: 5000 });
    } else if (x !== undefined && y !== undefined) {
      await this.page.touchscreen.tap(x, y);
    }
  }

  async tapText(text: string): Promise<boolean> {
    // Cari elemen yang mengandung teks ini lalu tap
    const el = this.page.getByText(text).first();
    const count = await el.count();
    if (count === 0) return false;
    await el.tap({ timeout: 5000 });
    return true;
  }

  async swipe(x1: number, y1: number, x2: number, y2: number, duration = 300): Promise<void> {
    await this.page.touchscreen.tap(x1, y1);
    const steps = Math.max(5, Math.floor(duration / 16));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      await this.page.touchscreen.tap(
        x1 + (x2 - x1) * t,
        y1 + (y2 - y1) * t,
      );
      await this.page.waitForTimeout(16);
    }
  }

  async type(selector: string, text: string): Promise<void> {
    await this.page.click(selector, { timeout: 5000 });
    await this.page.type(selector, text, { delay: 50 });
  }

  async key(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  async scroll(x = 0, y = 100, selector?: string): Promise<void> {
    if (selector) {
      await this.page.locator(selector).evaluate(
        (el, [dx, dy]) => el.scrollBy(dx as number, dy as number),
        [x, y]
      );
    } else {
      await this.page.mouse.wheel(x, y);
    }
  }

  async hold(selector: string, ms: number): Promise<void> {
    const el = await this.page.$(selector);
    if (!el) return;
    const box = await el.boundingBox();
    if (!box) return;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await this.page.touchscreen.tap(cx, cy);
    await this.page.waitForTimeout(ms);
  }
}
