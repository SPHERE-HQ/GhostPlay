// src/types.ts

export interface GhostPlayConfig {
  url: string;
  headed?: boolean;
  viewport?: { width: number; height: number };
  timeout?: number;
  screenshotsDir?: string;
}

export type StepType =
  | 'wait'
  | 'wait-for'
  | 'tap'
  | 'tap-text'
  | 'swipe'
  | 'type'
  | 'key'
  | 'scroll'
  | 'check-element'
  | 'check-text'
  | 'check-fps'
  | 'check-no-errors'
  | 'check-canvas-babylon'
  | 'check-blueprint'
  | 'screenshot'
  | 'log';

export type Step =
  | { type: 'wait';                 ms: number;               label?: string }
  | { type: 'wait-for';             selector: string;         timeout?: number; label?: string }
  | { type: 'tap';                  selector?: string;        x?: number; y?: number; label?: string }
  | { type: 'tap-text';             text: string;             label?: string }
  | { type: 'swipe';                x1: number; y1: number;  x2: number; y2: number; duration?: number; label?: string }
  | { type: 'type';                 selector: string;         text: string; label?: string }
  | { type: 'key';                  key: string;              label?: string }
  | { type: 'scroll';               x?: number; y?: number;  selector?: string; label?: string }
  | { type: 'check-element';        selector: string;         exists?: boolean; label?: string }
  | { type: 'check-text';           selector: string;         contains: string; label?: string }
  | { type: 'check-fps';            min: number;              duration?: number; label?: string }
  | { type: 'check-no-errors';      label?: string }
  | { type: 'check-canvas-babylon'; checks?: BabylonChecks;  label?: string }
  | { type: 'check-blueprint';      blueprint: Blueprint | string; label?: string }
  | { type: 'screenshot';           label: string }
  | { type: 'log';                  message: string };

// ─── Babylon.js Check Config ────────────────────────────────────────────────

export interface BabylonChecks {
  minFps?: number;
  minMeshCount?: number;
  requireActiveCamera?: boolean;
  requireScene?: boolean;
  requireEngine?: boolean;
  requireNotDisposed?: boolean;
  customObjects?: string[];       // window properties yang harus ada, misal ['game', 'playerController']
}

// ─── Blueprint Format ────────────────────────────────────────────────────────

export interface Blueprint {
  name: string;
  version?: string;
  description?: string;

  ui?: {
    elements: BlueprintElement[];
  };

  map?: {
    width?: number;
    height?: number;
    landmarks?: BlueprintLandmark[];
  };

  characters?: BlueprintCharacter[];

  performance?: {
    minFps?: number;
    maxLoadMs?: number;
  };

  babylon?: {
    checkEngine?: boolean;
    checkScene?: boolean;
    minMeshCount?: number;
    minDrawCalls?: number;
    requireGlobals?: string[];    // misal ['BABYLON', 'engine', 'scene']
  };
}

export interface BlueprintElement {
  selector: string;
  label: string;
  required?: boolean;             // default true
  text?: string;                  // isi teks yang harus ada
  visible?: boolean;              // harus visible (default true)
}

export interface BlueprintLandmark {
  id: string;
  label: string;
  selector?: string;
}

export interface BlueprintCharacter {
  name: string;
  selector?: string;
  hudHp?: string;
  hudAmmo?: string;
}

// ─── Result Types ────────────────────────────────────────────────────────────

export interface Scenario {
  name: string;
  description?: string;
  url?: string;
  steps: Step[];
  stopOnFail?: boolean;
}

export type StepStatus = 'ok' | 'warn' | 'fail' | 'skip' | 'info';

export interface StepResult {
  step: Step;
  status: StepStatus;
  message: string;
  durationMs: number;
  screenshotPath?: string;
  error?: string;
  detail?: BlueprintReport | BabylonReport;
}

export interface CapturedError {
  message: string;
  source: string;
  line: number;
  col: number;
  stack: string;
  timestamp: number;
}

export interface TestReport {
  scenario: string;
  passed: number;
  failed: number;
  warned: number;
  totalMs: number;
  results: StepResult[];
  errors: CapturedError[];
  success: boolean;
}

// ─── Blueprint Report ────────────────────────────────────────────────────────

export interface BlueprintRequirement {
  label: string;
  category: 'ui' | 'babylon' | 'performance' | 'character' | 'map';
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

export interface BlueprintReport {
  blueprintName: string;
  passed: number;
  failed: number;
  warned: number;
  requirements: BlueprintRequirement[];
}

// ─── Babylon Report ──────────────────────────────────────────────────────────

export interface BabylonReport {
  engineFound: boolean;
  sceneFound: boolean;
  fps: number;
  meshCount: number;
  drawCalls: number;
  activeCamera: boolean;
  isRunning: boolean;
  globals: Record<string, boolean>;
}
