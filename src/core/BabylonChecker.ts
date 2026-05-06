// src/core/BabylonChecker.ts
// Pengecekan khusus WebGL + Babylon.js engine

import { Page } from 'playwright';
import { BabylonChecks, BabylonReport } from '../types.js';
import { Reporter } from './Reporter.js';

export interface BabylonCheckResult {
  ok: boolean;
  message: string;
  report: BabylonReport;
}

export class BabylonChecker {
  constructor(private page: Page, private reporter: Reporter) {}

  async inspect(): Promise<BabylonReport> {
    return this.page.evaluate(() => {
      const win = window as any;
      const BABYLON = win.BABYLON;

      // Cari engine dari berbagai sumber umum
      const engine =
        BABYLON?.Engine?.Instances?.[0] ??
        BABYLON?.WebGPUEngine?.Instances?.[0] ??
        win.engine ??
        win._engine ??
        win.babylonEngine ??
        null;

      const scene =
        engine?.scenes?.[0] ??
        BABYLON?.Scene?.prototype.constructor._Instances?.[0] ??
        win.scene ??
        win._scene ??
        win.babylonScene ??
        null;

      // Kumpulkan info globals yang umum dipakai game
      const commonGlobals = [
        'BABYLON', 'engine', 'scene', 'game', 'playerController',
        'gameManager', 'hud', 'ui', 'inputManager', 'assetManager',
      ];
      const globals: Record<string, boolean> = {};
      for (const g of commonGlobals) {
        globals[g] = g in win && win[g] !== null && win[g] !== undefined;
      }

      // Draw calls — Babylon nyimpan di berbagai tempat tergantung versi
      const drawCalls =
        engine?._drawCalls?.current ??
        engine?.drawCalls ??
        scene?._drawCalls?.current ??
        0;

      return {
        engineFound:  !!engine,
        sceneFound:   !!scene,
        fps:          engine?.getFps?.() ?? 0,
        meshCount:    scene?.meshes?.length ?? 0,
        drawCalls:    typeof drawCalls === 'object' ? drawCalls.current ?? 0 : drawCalls,
        activeCamera: !!scene?.activeCamera,
        isRunning:    engine ? !engine.isDisposed : false,
        globals,
      } satisfies import('../types.js').BabylonReport;
    });
  }

  async check(checks: BabylonChecks = {}): Promise<BabylonCheckResult> {
    const report = await this.inspect();
    const issues: string[] = [];
    const notes: string[] = [];

    if (checks.requireEngine !== false && !report.engineFound) {
      issues.push('Babylon.js Engine tidak ditemukan di window');
    }

    if (checks.requireScene !== false && !report.sceneFound) {
      issues.push('Babylon.js Scene tidak ditemukan');
    }

    if (checks.requireNotDisposed !== false && report.engineFound && !report.isRunning) {
      issues.push('Engine sudah disposed / tidak berjalan');
    }

    if (checks.requireActiveCamera && !report.activeCamera) {
      issues.push('Tidak ada activeCamera di scene');
    }

    if (checks.minFps !== undefined) {
      if (report.fps < checks.minFps) {
        issues.push(`FPS ${report.fps} di bawah minimal ${checks.minFps}`);
      } else {
        notes.push(`FPS ${report.fps} ✓`);
      }
    }

    if (checks.minMeshCount !== undefined) {
      if (report.meshCount < checks.minMeshCount) {
        issues.push(`Mesh di scene: ${report.meshCount}, minimal ${checks.minMeshCount}`);
      } else {
        notes.push(`Mesh count: ${report.meshCount} ✓`);
      }
    }

    if (checks.customObjects && checks.customObjects.length > 0) {
      for (const obj of checks.customObjects) {
        if (!report.globals[obj] && !(await this.page.evaluate((o) => !!(window as any)[o], obj))) {
          issues.push(`window.${obj} tidak ditemukan`);
        } else {
          notes.push(`window.${obj} ada ✓`);
        }
      }
    }

    const ok = issues.length === 0;
    const summary = ok
      ? `Babylon.js OK — Engine: ${report.engineFound}, Scene: ${report.sceneFound}, FPS: ${report.fps}, Meshes: ${report.meshCount}` +
        (notes.length > 0 ? ` | ${notes.join(', ')}` : '')
      : `Babylon.js gagal: ${issues.join('; ')}`;

    return { ok, message: summary, report };
  }

  // Cek apakah canvas WebGL benar-benar merender sesuatu (tidak blank)
  async isWebGLRendering(): Promise<{ ok: boolean; message: string; pixelInfo: string }> {
    const result = await this.page.evaluate(() => {
      const canvases = Array.from(document.querySelectorAll('canvas'));
      if (canvases.length === 0) return { ok: false, info: 'Tidak ada canvas di halaman' };

      for (const canvas of canvases) {
        // Coba WebGL2 dulu, lalu WebGL1
        const gl =
          (canvas.getContext('webgl2') as WebGL2RenderingContext | null) ??
          (canvas.getContext('webgl') as WebGLRenderingContext | null);

        if (!gl) continue;

        const w = canvas.width;
        const h = canvas.height;
        if (w === 0 || h === 0) continue;

        // Sample 25 pixel di tengah canvas
        const sampleW = Math.min(5, Math.floor(w / 4));
        const sampleH = Math.min(5, Math.floor(h / 4));
        const pixels = new Uint8Array(sampleW * sampleH * 4);
        gl.readPixels(
          Math.floor(w / 2) - Math.floor(sampleW / 2),
          Math.floor(h / 2) - Math.floor(sampleH / 2),
          sampleW, sampleH,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels
        );

        let nonBlack = 0;
        let totalAlpha = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i] > 8 || pixels[i + 1] > 8 || pixels[i + 2] > 8) nonBlack++;
          totalAlpha += pixels[i + 3];
        }
        const total = pixels.length / 4;
        const avgAlpha = Math.round(totalAlpha / total);
        const nonBlackPct = Math.round((nonBlack / total) * 100);

        if (nonBlack > 0 || avgAlpha > 0) {
          return {
            ok: true,
            info: `Canvas ${w}x${h} — ${nonBlackPct}% pixel non-hitam, alpha rata-rata ${avgAlpha}`,
          };
        }
      }

      return {
        ok: false,
        info: `Semua ${canvases.length} canvas blank/hitam — WebGL mungkin belum render atau preserveDrawingBuffer=false`,
      };
    });

    return { ok: result.ok, message: result.ok ? result.info : `WebGL BLANK: ${result.info}`, pixelInfo: result.info };
  }
}
