// scenarios/example.ts
// Contoh scenario TypeScript — salin dan sesuaikan dengan game kamu
import { defineScenario } from '../src/index.js';

export default defineScenario({
  name: 'My Game — Full Flow Test',
  description: 'Boot → Main Menu → Gameplay → Cek HUD + Blueprint + Asset',
  url: 'http://localhost:5173',
  stopOnFail: false,
  steps: [

    // ── Pre-check: validasi semua file asset sebelum game dibuka ──────────
    { type: 'log', message: '=== PRE-CHECK: Asset Files ===' },
    {
      type: 'check-assets',
      assets: 'blueprints/example.blueprint.json',
      label: 'Semua asset file sesuai spec',
    },

    // ── Boot ──────────────────────────────────────────────────────────────
    { type: 'log', message: '=== FASE 1: Boot ===' },
    { type: 'screenshot', label: '01_boot' },
    { type: 'check-element', selector: '#boot-overlay', label: 'Boot screen muncul' },
    { type: 'wait', ms: 2000, label: 'Tunggu boot selesai' },
    { type: 'check-element', selector: '#boot-overlay', exists: false, label: 'Boot screen hilang' },

    // ── Main Menu ─────────────────────────────────────────────────────────
    { type: 'log', message: '=== FASE 2: Main Menu ===' },
    { type: 'wait-for', selector: '#main-menu', timeout: 5000, label: 'Main menu muncul' },
    { type: 'screenshot', label: '02_main_menu' },
    { type: 'tap-text', text: 'PLAY', label: 'Tap tombol PLAY' },

    // ── Gameplay ──────────────────────────────────────────────────────────
    { type: 'log', message: '=== FASE 3: Gameplay ===' },
    { type: 'wait', ms: 3000, label: 'Tunggu game load' },
    { type: 'screenshot', label: '03_gameplay' },

    // ── Babylon.js Engine ─────────────────────────────────────────────────
    { type: 'log', message: '=== FASE 4: Engine Check ===' },
    {
      type: 'check-canvas-babylon',
      label: 'Babylon.js engine sehat',
      checks: {
        requireEngine:       true,
        requireScene:        true,
        requireActiveCamera: true,
        minFps:              30,
        minMeshCount:        5,
        customObjects:       ['game'],
      },
    },

    // ── HUD ───────────────────────────────────────────────────────────────
    { type: 'log', message: '=== FASE 5: HUD Check ===' },
    { type: 'check-element', selector: '#game-hud',       label: 'HUD container ada' },
    { type: 'check-element', selector: '#hud-hp',         label: 'HP bar ada' },
    { type: 'check-element', selector: '#hud-ammo',       label: 'Ammo ada' },
    { type: 'check-element', selector: '#minimap-canvas', label: 'Minimap ada' },

    // ── Blueprint Compliance ──────────────────────────────────────────────
    { type: 'log', message: '=== FASE 6: Blueprint ===' },
    {
      type: 'check-blueprint',
      blueprint: 'blueprints/example.blueprint.json',
      label: 'Game sesuai blueprint',
    },

    // ── Performance ───────────────────────────────────────────────────────
    { type: 'log', message: '=== FASE 7: Performance ===' },
    { type: 'check-fps', min: 30, duration: 2000, label: 'FPS minimal 30' },

    // ── Kontrol ───────────────────────────────────────────────────────────
    { type: 'log', message: '=== FASE 8: Kontrol ===' },
    { type: 'swipe', x1: 80, y1: 600, x2: 140, y2: 600, duration: 500, label: 'Swipe kanan' },
    { type: 'swipe', x1: 80, y1: 600, x2: 80,  y2: 540, duration: 500, label: 'Swipe maju' },
    { type: 'wait', ms: 1000 },
    { type: 'tap', x: 310, y: 650, label: 'Tap tombol aksi' },
    { type: 'screenshot', label: '04_gameplay_action' },

    // ── Error Check ───────────────────────────────────────────────────────
    { type: 'log', message: '=== FASE 9: Error Check ===' },
    { type: 'check-no-errors', label: 'Tidak ada JS error' },
    { type: 'screenshot', label: '05_final' },
  ],
});
