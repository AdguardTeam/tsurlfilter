import { RuleParser, DomainListParser } from '@adguard/agtree/parser';
import { ok } from 'assert';

// Ensure the names are exported.
// The `./parser` subpath was remapped in the AGTree v5 migration
// (parser-legacy → new structural parser), so it is smoke-tested explicitly.
ok(RuleParser.parse);
ok(DomainListParser.parse);

console.log('Smoke test passed in parser.ts');
