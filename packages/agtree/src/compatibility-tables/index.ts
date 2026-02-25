/**
 * @file Compatibility table exports.
 */

// Re-export compatibility table instances with proper name normalizers
export { modifiersCompatibilityTable } from './modifiers';
export { redirectsCompatibilityTable } from './redirects';
export { scriptletsCompatibilityTable } from './scriptlets';

// Re-export Platform class and evaluator for convenience
export { Platform } from './platform';
export { ProductCode, PlatformType, PlatformSpecific } from './platform';
export type { SpecificProductCode, SpecificPlatformType } from './platform';
export { PlatformExpressionEvaluator } from './platform-expression-evaluator';
