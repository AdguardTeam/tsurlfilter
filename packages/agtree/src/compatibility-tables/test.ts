import { modifiersCompatibilityTable } from './modifiers';
import { Platform } from './platform';
import { PlatformExpressionEvaluator } from './platform-expression-evaluator';

console.log('has third-party:', modifiersCompatibilityTable.has('third-party'));
console.log('has 3p:', modifiersCompatibilityTable.has('3p'));
console.log('\nQuery third-party with AbpAny:');
console.log(modifiersCompatibilityTable.query('third-party', Platform.AbpAny));
console.log('\nQuery 3p with Platform.Any:');
console.log(modifiersCompatibilityTable.query('3p', Platform.Any));

console.log('\nPlatform.Any details:');
console.log('  toString():', Platform.Any.toString());
console.log('  toPath():', Platform.Any.toPath());
console.log('  isWildcard:', Platform.Any.isWildcard);

console.log('\nDoes Platform.Any match AdgExtChrome?', Platform.Any.matches(Platform.AdgExtChrome));
console.log('Does AdgAny match AdgExtChrome?', Platform.AdgAny.matches(Platform.AdgExtChrome));

console.log(modifiersCompatibilityTable.groupByProduct());
