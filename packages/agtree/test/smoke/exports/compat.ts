import * as compat from '@adguard/agtree/compat';
import { ok } from 'assert';

// The v4 shim lives on its own subpath so `./parser` stays light (F-015).
ok(compat.RuleParser.parse);
ok(compat.defaultParserOptions);

const rule = compat.RuleParser.parse('||example.com^');
ok(rule?.type === 'NetworkRule');

console.log('Smoke test passed in compat.ts');
