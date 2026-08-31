import { CosmeticRuleGenerator, RuleGenerator } from '@adguard/agtree/generator';
import { ok } from 'assert';

ok(RuleGenerator.generate);
ok(CosmeticRuleGenerator.generate);

console.log('Smoke test passed in generator.ts');
