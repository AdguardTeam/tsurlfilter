import * as parser from '@adguard/agtree/parser';
import { StructuralRuleParser, DomainListParser } from '@adguard/agtree/parser';
import { ok } from 'assert';

// Ensure the names are exported.
// The `./parser` subpath was remapped in the AGTree v5 migration
// (parser-legacy → new structural parser), so it is smoke-tested explicitly.
ok(StructuralRuleParser.parse);
ok(DomainListParser.parse);

// The v4 compat shim moved to `@adguard/agtree/compat`: importing it from
// `./parser` pulled the AST builders, the node barrel and the walker into the
// module graph (F-015).
ok(!('RuleParser' in parser));
ok(!('defaultParserOptions' in parser));

console.log('Smoke test passed in parser.ts');
