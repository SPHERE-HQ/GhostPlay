// src/core/BlueprintChecker.ts
// Validasi game terhadap blueprint spec — solusi untuk "agent buat game tidak sesuai spec"

import { Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import {
  Blueprint,
  BlueprintReport,
  BlueprintRequirement,
} from '../types.js';
import { BabylonChecker } from './BabylonChecker.js';
import { Reporter } from './Reporter.js';

export class BlueprintChecker {
  private babylon: BabylonChecker;

  constructor(private page: Page, private reporter: Reporter) {
    this.babylon = new BabylonChecker(page, reporter);
  }

  // Load blueprint dari file JSON atau terima inline object
  loadBlueprint(source: Blueprint | string): Blueprint {
    if (typeof source === 'string') {
      const absPath = path.isAbsolute(source) ? source : path.resolve(process.cwd(), source);
      if (!fs.existsSync(absPath)) {
        throw new Error(`Blueprint file tidak ditemukan: ${absPath}`);
      }
      const raw = fs.readFileSync(absPath, 'utf-8');
      return JSON.parse(raw) as Blueprint;
    }
    return source;
  }

  async validate(source: Blueprint | string): Promise<BlueprintReport> {
    const blueprint = this.loadBlueprint(source);
    const requirements: BlueprintRequirement[] = [];

    this.reporter.info(`Validasi blueprint: "${blueprint.name}"`);

    // ── 1. UI Elements ──────────────────────────────────────────────────────
    if (blueprint.ui?.elements) {
      for (const el of blueprint.ui.elements) {
        const required = el.required !== false;
        const req = await this.checkUIElement(el);
        if (!required && req.status === 'fail') req.status = 'warn';
        requirements.push(req);
      }
    }

    // ── 2. Characters ───────────────────────────────────────────────────────
    if (blueprint.characters) {
      for (const char of blueprint.characters) {
        if (char.selector) {
          const visible = await this.domVisible(char.selector);
          requirements.push({
            label: `Karakter "${char.name}" ada di DOM`,
            category: 'character',
            status: visible ? 'pass' : 'fail',
            message: visible
              ? `"${char.selector}" ditemukan`
              : `"${char.selector}" tidak ditemukan — pastikan hero "${char.name}" di-render`,
          });
        }
        if (char.hudHp) {
          const visible = await this.domVisible(char.hudHp);
          requirements.push({
            label: `HUD HP "${char.name}" ada`,
            category: 'character',
            status: visible ? 'pass' : 'fail',
            message: visible
              ? `"${char.hudHp}" ditemukan`
              : `"${char.hudHp}" tidak ada — HUD HP untuk ${char.name} belum dibuat`,
          });
        }
        if (char.hudAmmo) {
          const visible = await this.domVisible(char.hudAmmo);
          requirements.push({
            label: `HUD Ammo "${char.name}" ada`,
            category: 'character',
            status: visible ? 'pass' : 'fail',
            message: visible
              ? `"${char.hudAmmo}" ditemukan`
              : `"${char.hudAmmo}" tidak ada — HUD Ammo untuk ${char.name} belum dibuat`,
          });
        }
      }
    }

    // ── 3. Babylon.js Engine ────────────────────────────────────────────────
    if (blueprint.babylon) {
      const babylonReport = await this.babylon.inspect();

      if (blueprint.babylon.checkEngine) {
        requirements.push({
          label: 'Babylon.js Engine berjalan',
          category: 'babylon',
          status: babylonReport.engineFound && babylonReport.isRunning ? 'pass' : 'fail',
          message: babylonReport.engineFound
            ? babylonReport.isRunning
              ? `Engine aktif, FPS: ${babylonReport.fps}`
              : 'Engine ditemukan tapi sudah disposed'
            : 'BABYLON.Engine tidak ditemukan — pastikan engine diinisialisasi dan disimpan ke window.engine',
        });
      }

      if (blueprint.babylon.checkScene) {
        requirements.push({
          label: 'Babylon.js Scene aktif',
          category: 'babylon',
          status: babylonReport.sceneFound ? 'pass' : 'fail',
          message: babylonReport.sceneFound
            ? `Scene ada, ${babylonReport.meshCount} mesh, activeCamera: ${babylonReport.activeCamera}`
            : 'Scene tidak ditemukan — simpan referensi scene ke window.scene',
        });
      }

      if (blueprint.babylon.minMeshCount !== undefined) {
        const ok = babylonReport.meshCount >= blueprint.babylon.minMeshCount;
        requirements.push({
          label: `Scene minimal ${blueprint.babylon.minMeshCount} mesh`,
          category: 'babylon',
          status: ok ? 'pass' : 'fail',
          message: ok
            ? `${babylonReport.meshCount} mesh di scene ✓`
            : `Hanya ${babylonReport.meshCount} mesh, minimal ${blueprint.babylon.minMeshCount} — pastikan semua asset ter-load`,
        });
      }

      if (blueprint.babylon.requireGlobals) {
        for (const g of blueprint.babylon.requireGlobals) {
          const found = babylonReport.globals[g] ??
            await this.page.evaluate((obj) => obj in window && (window as any)[obj] != null, g);
          requirements.push({
            label: `window.${g} tersedia`,
            category: 'babylon',
            status: found ? 'pass' : 'fail',
            message: found
              ? `window.${g} ada ✓`
              : `window.${g} tidak ditemukan — agent perlu expose object ini ke window`,
          });
        }
      }
    }

    // ── 4. Performance ──────────────────────────────────────────────────────
    if (blueprint.performance?.minFps !== undefined) {
      await this.page.waitForTimeout(1500);
      const fps = await this.page.evaluate(() => (window as any).__ghostplay_fps?.avg ?? 0);
      const minFps = blueprint.performance.minFps;
      const ok = fps >= minFps;
      requirements.push({
        label: `FPS minimal ${minFps}`,
        category: 'performance',
        status: ok ? 'pass' : 'warn',
        message: ok
          ? `FPS rata-rata ${fps} ✓`
          : `FPS rata-rata ${fps}, di bawah target ${minFps} — optimasi rendering atau kurangi draw calls`,
      });
    }

    // ── 5. Map Landmarks ────────────────────────────────────────────────────
    if (blueprint.map?.landmarks) {
      for (const landmark of blueprint.map.landmarks) {
        if (landmark.selector) {
          const visible = await this.domVisible(landmark.selector);
          requirements.push({
            label: `Map landmark: "${landmark.label}"`,
            category: 'map',
            status: visible ? 'pass' : 'fail',
            message: visible
              ? `"${landmark.selector}" ada ✓`
              : `"${landmark.selector}" tidak ditemukan — landmark "${landmark.label}" belum diimplementasi`,
          });
        }
      }
    }

    const passed = requirements.filter(r => r.status === 'pass').length;
    const failed = requirements.filter(r => r.status === 'fail').length;
    const warned = requirements.filter(r => r.status === 'warn').length;

    this.printBlueprintReport(blueprint.name, requirements);

    return { blueprintName: blueprint.name, passed, failed, warned, requirements };
  }

  private async checkUIElement(el: Blueprint['ui'] extends { elements: infer E[] } ? E : never): Promise<BlueprintRequirement> {
    const selector = (el as any).selector as string;
    const label    = (el as any).label as string;
    const text     = (el as any).text as string | undefined;
    const visible  = (el as any).visible !== false;

    const found = await this.domVisible(selector, visible ? 'visible' : 'attached');
    if (!found) {
      return {
        label: `UI: ${label}`,
        category: 'ui',
        status: 'fail',
        message: `"${selector}" tidak ${visible ? 'terlihat' : 'ada'} — elemen "${label}" hilang atau selectornya salah`,
      };
    }

    if (text) {
      const content = await this.page.evaluate(
        (sel) => document.querySelector(sel)?.textContent ?? '',
        selector
      );
      if (!content.includes(text)) {
        return {
          label: `UI: ${label} (isi teks)`,
          category: 'ui',
          status: 'fail',
          message: `"${selector}" ada tapi tidak mengandung teks "${text}" — isi saat ini: "${content.slice(0, 60)}"`,
        };
      }
    }

    return {
      label: `UI: ${label}`,
      category: 'ui',
      status: 'pass',
      message: `"${selector}" ${visible ? 'terlihat' : 'ada'}${text ? ` dan mengandung "${text}"` : ''} ✓`,
    };
  }

  private async domVisible(selector: string, state: 'visible' | 'attached' = 'visible'): Promise<boolean> {
    try {
      await this.page.waitForSelector(selector, { timeout: 2000, state });
      return true;
    } catch {
      return false;
    }
  }

  private printBlueprintReport(name: string, reqs: BlueprintRequirement[]): void {
    const C = {
      reset: '\x1b[0m', bold: '\x1b[1m',
      green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
      cyan: '\x1b[36m', gray: '\x1b[90m',
    };
    const line = `${C.gray}${'─'.repeat(60)}${C.reset}`;
    console.log(line);
    console.log(`${C.bold}${C.cyan}[Blueprint] ${name}${C.reset}`);
    console.log(line);

    const grouped: Record<string, BlueprintRequirement[]> = {};
    for (const r of reqs) {
      (grouped[r.category] ??= []).push(r);
    }

    const categoryLabel: Record<string, string> = {
      ui: 'UI Elements', babylon: 'Babylon.js Engine',
      performance: 'Performance', character: 'Characters', map: 'Map',
    };

    for (const [cat, items] of Object.entries(grouped)) {
      console.log(`\n${C.bold}  ${categoryLabel[cat] ?? cat}${C.reset}`);
      for (const req of items) {
        const icon =
          req.status === 'pass' ? `${C.green}✓${C.reset}` :
          req.status === 'warn' ? `${C.yellow}⚠${C.reset}` :
                                  `${C.red}✗${C.reset}`;
        console.log(`  ${icon} ${req.label}`);
        if (req.status !== 'pass') {
          console.log(`    ${C.gray}↳ ${req.message}${C.reset}`);
        }
      }
    }

    const passed = reqs.filter(r => r.status === 'pass').length;
    const failed = reqs.filter(r => r.status === 'fail').length;
    const warned = reqs.filter(r => r.status === 'warn').length;
    console.log(`\n${line}`);
    console.log(`  ${C.green}✓ ${passed} sesuai blueprint${C.reset}   ${C.red}✗ ${failed} tidak sesuai${C.reset}   ${C.yellow}⚠ ${warned} peringatan${C.reset}`);
    if (failed > 0) {
      console.log(`\n  ${C.bold}${C.red}GAME BELUM SESUAI BLUEPRINT — ${failed} item perlu diperbaiki${C.reset}`);
    } else {
      console.log(`\n  ${C.bold}${C.green}GAME SESUAI BLUEPRINT ✓${C.reset}`);
    }
    console.log(line);
  }
}
