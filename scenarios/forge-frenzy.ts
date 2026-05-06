// scenarios/forge-frenzy.ts
// Test lengkap Forge Frenzy: dari boot sampai gameplay aktif
import { defineScenario } from '../src/index';

export default defineScenario({
  name: 'Forge Frenzy — Full Flow Test',
  description: 'Boot → Nickname → Hero Select → Game → Cek HUD + Canvas rendering',
  url: 'http://localhost:5173',
  stopOnFail: false,
  steps: [

    // ── 1. Boot Screen ─────────────────────────────────────────────────────
    { type: 'log', message: '=== FASE 1: Boot Screen ===' },
    { type: 'screenshot', label: '01_boot_start' },
    { type: 'check-element', selector: '#boot-overlay', label: 'Boot overlay muncul' },
    { type: 'wait', ms: 1500, label: 'Tunggu boot selesai' },
    { type: 'check-element', selector: '#boot-overlay', exists: false, label: 'Boot overlay hilang' },
    { type: 'screenshot', label: '02_after_boot' },

    // ── 2. Nickname Scene ──────────────────────────────────────────────────
    { type: 'log', message: '=== FASE 2: Nickname ===' },
    { type: 'wait-for', selector: 'input', timeout: 5000, label: 'Input nickname muncul' },
    { type: 'screenshot', label: '03_nickname_scene' },
    { type: 'type', selector: 'input', text: 'GhostTester', label: 'Ketik nickname' },
    { type: 'tap-text', text: 'LANJUT', label: 'Tap tombol LANJUT' },

    // ── 3. Hero Select ─────────────────────────────────────────────────────
    { type: 'log', message: '=== FASE 3: Hero Select ===' },
    { type: 'wait', ms: 500 },
    { type: 'screenshot', label: '04_hero_select' },
    { type: 'tap-text', text: 'BRIX', label: 'Pilih hero BRIX' },
    { type: 'wait', ms: 300 },
    { type: 'tap-text', text: 'MAIN', label: 'Tap tombol MAIN' },

    // ── 4. Game Scene: Canvas ──────────────────────────────────────────────
    { type: 'log', message: '=== FASE 4: Game Scene ===' },
    { type: 'wait', ms: 3500, label: 'Tunggu countdown + game load' },
    { type: 'screenshot', label: '05_gameplay' },

    // Cek canvas tidak blank
    { type: 'check-element', selector: 'canvas', label: 'Canvas WebGL ada' },

    // ── 5. HUD Elements ────────────────────────────────────────────────────
    { type: 'log', message: '=== FASE 5: HUD Check ===' },
    { type: 'check-element', selector: '#game-hud',    label: 'HUD container ada' },
    { type: 'check-element', selector: '#hud-hp',      label: 'HP bar ada' },
    { type: 'check-element', selector: '#hud-shield',  label: 'Shield bar ada' },
    { type: 'check-element', selector: '#hud-ammo',    label: 'Ammo display ada' },
    { type: 'check-element', selector: '#hud-kills',   label: 'Kill counter ada' },
    { type: 'check-element', selector: '#hud-ult',     label: 'Ultimate bar ada' },

    // Minimap
    { type: 'check-element', selector: '#minimap-canvas', label: 'Minimap canvas ada' },

    // ── 6. Performance ─────────────────────────────────────────────────────
    { type: 'log', message: '=== FASE 6: Performance ===' },
    { type: 'check-fps', min: 30, duration: 2000, label: 'FPS minimal 30' },
    { type: 'screenshot', label: '06_gameplay_hud' },

    // ── 7. Kontrol: Joystick area (kiri layar) ────────────────────────────
    { type: 'log', message: '=== FASE 7: Kontrol ===' },
    { type: 'swipe', x1: 80, y1: 600, x2: 140, y2: 600, duration: 500, label: 'Swipe joystick kanan' },
    { type: 'wait', ms: 500 },
    { type: 'swipe', x1: 80, y1: 600, x2: 80, y2: 540, duration: 500, label: 'Swipe joystick maju' },
    { type: 'wait', ms: 1000 },
    { type: 'screenshot', label: '07_after_move' },

    // ── 8. Tombol UI kanan ─────────────────────────────────────────────────
    { type: 'tap', x: 310, y: 650, label: 'Tap area tombol TEMBAK' },
    { type: 'wait', ms: 300 },

    // ── 9. Final Error Check ────────────────────────────────────────────────
    { type: 'log', message: '=== FASE 9: Error Check ===' },
    { type: 'check-no-errors', label: 'Tidak ada JS error selama sesi' },
    { type: 'screenshot', label: '08_final_state' },
  ],
});
