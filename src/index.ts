// src/index.ts
export { GhostPlay } from './core/GhostPlay';
export { Reporter } from './core/Reporter';
export { InputSimulator } from './core/InputSimulator';
export { DOMChecker } from './core/DOMChecker';
export { ErrorCollector } from './core/ErrorCollector';
export { PerfMonitor } from './core/PerfMonitor';
export type {
  GhostPlayConfig,
  Scenario,
  Step,
  StepResult,
  StepStatus,
  TestReport,
  CapturedError,
} from './types';

// Helper: definisikan scenario dengan type-safety penuh
export function defineScenario(scenario: import('./types').Scenario): import('./types').Scenario {
  return scenario;
}
