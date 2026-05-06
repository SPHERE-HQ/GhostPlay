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
  | 'check-assets'
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
  | { type: 'check-assets';         assets: AssetsSpec | string;  label?: string }
  | { type: 'screenshot';           label: string }
  | { type: 'log';                  message: string };

// ─── Babylon.js Check Config ─────────────────────────────────────────────────

export interface BabylonChecks {
  minFps?: number;
  minMeshCount?: number;
  requireActiveCamera?: boolean;
  requireScene?: boolean;
  requireEngine?: boolean;
  requireNotDisposed?: boolean;
  customObjects?: string[];
}

// ─── Asset Spec ───────────────────────────────────────────────────────────────

export interface AssetsSpec {
  rootDir?: string;              // root direktori project, default process.cwd()
  models?:  AssetModelSpec[];
  textures?: AssetTextureSpec[];
  audio?:   AssetAudioSpec[];
}

export interface AssetModelSpec {
  file: string;                  // path relatif dari rootDir, misal "public/models/brix.glb"
  label: string;                 // nama deskriptif, misal "Karakter BRIX"
  expectedMeshes?: string[];     // nama mesh yang harus ada di dalam file
  expectedAnimations?: string[]; // nama animasi yang harus ada
  expectedMaterials?: string[];  // nama material yang harus ada
  requireRig?: boolean;          // harus punya skeleton/armature
  minPolyCount?: number;         // minimum triangle count
  inScene?: boolean;             // harus ter-load di Babylon.js scene saat runtime
  sceneNamePattern?: string;     // pattern nama mesh di scene (substring match)
}

export interface AssetTextureSpec {
  file: string;
  label: string;
  minWidth?: number;
  minHeight?: number;
  inScene?: boolean;
}

export interface AssetAudioSpec {
  file: string;
  label: string;
}

export interface AssetRequirement {
  label: string;
  category: 'model' | 'texture' | 'audio' | 'scene';
  status: 'pass' | 'fail' | 'warn';
  message: string;
  file?: string;
}

export interface AssetCheckReport {
  passed: number;
  failed: number;
  warned: number;
  requirements: AssetRequirement[];
}

// ─── Blueprint Format ─────────────────────────────────────────────────────────

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
    requireGlobals?: string[];
  };

  assets?: AssetsSpec;           // asset spec bisa juga ditaruh langsung di blueprint
}

export interface BlueprintElement {
  selector: string;
  label: string;
  required?: boolean;
  text?: string;
  visible?: boolean;
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

// ─── Result Types ─────────────────────────────────────────────────────────────

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
  detail?: BlueprintReport | BabylonReport | AssetCheckReport;
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

// ─── Blueprint Report ─────────────────────────────────────────────────────────

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

// ─── Babylon Report ───────────────────────────────────────────────────────────

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
