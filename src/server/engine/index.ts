// Interface pública do motor. A API importa somente daqui.
export { SimulationEngine, type SimulationEngineOptions } from './SimulationEngine.js';
export { SimulationValidationError, type ValidationIssue, type ValidationIssueCode } from './errors.js';
export { DEFAULT_LIMITS, type GraphValidatorLimits } from './GraphValidator.js';
export * from './types.js';
