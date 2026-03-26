import { expectNotType } from 'tsd';

import { RuleParser } from '@adguard/agtree/parser';
import { CosmeticRuleGenerator, RuleGenerator } from '@adguard/agtree/generator';

expectNotType<any>(RuleParser.parse);
expectNotType<any>(RuleGenerator.generate);
expectNotType<any>(CosmeticRuleGenerator.generate);

console.log('Smoke test passed in index.test-d.ts');
