import { RuleConverter, FilterListConverter } from '@adguard/agtree/converter';
import { ok } from 'assert';

// Ensure the names are exported
ok(RuleConverter.convertToAdg);
ok(FilterListConverter.convertToAdg);

console.log('Smoke test passed in converter.ts');
