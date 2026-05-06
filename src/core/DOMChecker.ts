// src/core/DOMChecker.ts
import { Page } from 'playwright';
import { Reporter } from './Reporter';

export interface CheckResult {
  ok: boolean;
  message: string;
}

export class DOMChecker {
  constructor(private page: Page, private reporter: Reporter) {}

  async exists(selector: string, timeout = 3000): Promise<CheckResult> {
    try {
      await this.page.waitForSelector(selector, { timeout, state: 'attached' });
      const el = await this.page.$(selector);
      return { ok: !!el, message: el ? `"${selector}" ditemukan di DOM` : `"${selector}" tidak ada` };
    } catch {
      return { ok: false, message: `"${selector}" tidak ditemukan (timeout ${timeout}ms)` };
    }
  }

  async visible(selector: string, timeout = 3000): Promise<CheckResult> {
    try {
      await this.page.waitForSelector(selector, { timeout, state: 'visible' });
      return { ok: true, message: `"${selector}" terlihat di layar` };
    } catch {
      return { ok: false, message: `"${selector}" tidak terlihat (mungkin display:none atau di luar viewport)` };
    }
  }

  async containsText(selector: string, text: string): Promise<CheckResult> {
    const el = await this.page.$(selector);
    if (!el) return { ok: false, message: `"${selector}" tidak ditemukan` };
    const content = await el.textContent() ?? '';
    const ok = content.includes(text);
    return {
      ok,
      message: ok
        ? `"${selector}" mengandung teks "${text}"`
        : `"${selector}" tidak mengandung "${text}" (isi: "${content.slice(0, 50)}")`,
    };
  }

  async count(selector: string, expected: number): Promise<CheckResult> {
    const els = await this.page.$$(selector);
    const ok = els.length === expected;
    return {
      ok,
      message: ok
        ? `"${selector}" ditemukan ${expected} elemen`
        : `"${selector}" ditemukan ${els.length} elemen, expected ${expected}`,
    };
  }

  async getCanvasSize(): Promise<{ width: number; height: number } | null> {
    return this.page.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) return null;
      return { width: canvas.width, height: canvas.height };
    });
  }

  async isCanvasRendering(): Promise<CheckResult> {
    // Ambil sample pixel dari canvas — kalau semua transparan/hitam berarti tidak render
    const result = await this.page.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) return { ok: false, reason: 'canvas tidak ditemukan' };

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        // WebGL canvas — cek apakah ada pixels
        try {
          const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
          if (!gl) return { ok: false, reason: 'WebGL context tidak ada' };
          const pixels = new Uint8Array(4 * 100);
          const w = canvas.width, h = canvas.height;
          (gl as WebGLRenderingContext).readPixels(
            Math.floor(w / 2) - 5, Math.floor(h / 2) - 5,
            10, 10,
            (gl as WebGLRenderingContext).RGBA,
            (gl as WebGLRenderingContext).UNSIGNED_BYTE,
            pixels
          );
          // Cek apakah ada pixel yang bukan hitam/transparan
          let nonBlack = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i] > 5 || pixels[i+1] > 5 || pixels[i+2] > 5) nonBlack++;
          }
          return { ok: nonBlack > 0, reason: nonBlack > 0 ? `${nonBlack}/25 pixel non-hitam` : 'semua pixel hitam/transparan' };
        } catch (e) {
          return { ok: false, reason: 'tidak bisa baca WebGL pixels (preserveDrawingBuffer mungkin false)' };
        }
      }

      const imageData = ctx.getImageData(
        Math.floor(canvas.width / 4), Math.floor(canvas.height / 4),
        Math.floor(canvas.width / 2), Math.floor(canvas.height / 2)
      );
      let nonTransparent = 0;
      for (let i = 3; i < imageData.data.length; i += 4) {
        if (imageData.data[i] > 0) nonTransparent++;
      }
      const total = imageData.data.length / 4;
      const pct = Math.round((nonTransparent / total) * 100);
      return { ok: pct > 10, reason: `${pct}% pixel terisi` };
    });

    return { ok: result.ok, message: result.ok ? `Canvas rendering: ${result.reason}` : `Canvas BLANK: ${result.reason}` };
  }
}
