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
  | 'screenshot'
  | 'log';

export type Step =
  | { type: 'wait';           ms: number;               label?: string }
  | { type: 'wait-for';       selector: string;         timeout?: number; label?: string }
  | { type: 'tap';            selector?: string;        x?: number; y?: number; label?: string }
  | { type: 'tap-text';       text: string;             label?: string }
  | { type: 'swipe';          x1: number; y1: number;  x2: number; y2: number; duration?: number; label?: string }
  | { type: 'type';           selector: string;         text: string; label?: string }
  | { type: 'key';            key: string;              label?: string }
  | { type: 'scroll';         x?: number; y?: number;  selector?: string; label?: string }
  | { type: 'check-element';  selector: string;         exists?: boolean; label?: string }
  | { type: 'check-text';     selector: string;         contains: string; label?: string }
  | { type: 'check-fps';      min: number;              duration?: number; label?: string }
  | { type: 'check-no-errors'; label?: string }
  | { type: 'screenshot';     label: string }
  | { type: 'log';            message: string };

export interface Scenario {
  name: string;
  description?: string;
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
