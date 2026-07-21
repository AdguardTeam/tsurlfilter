import { CosmeticRuleGenerator, RuleGenerator } from '@adguard/agtree/generator-new';
import { ok } from 'assert';

ok(RuleGenerator.generate);
ok(CosmeticRuleGenerator.generate);

console.log('Smoke test passed in generator-new.ts');
