import { expectNotType } from 'tsd';

import { RuleParser } from '@adguard/agtree/parser';
import { CosmeticRuleGenerator, RuleGenerator } from '@adguard/agtree/generator';
import { RuleConverter, FilterListConverter } from '@adguard/agtree/converter-new';
import { CosmeticRuleGenerator as NewCosmeticRuleGenerator, RuleGenerator as NewRuleGenerator } from '@adguard/agtree/generator-new';

expectNotType<any>(RuleParser.parse);
expectNotType<any>(RuleGenerator.generate);
expectNotType<any>(CosmeticRuleGenerator.generate);
expectNotType<any>(RuleConverter.convertToAdg);
expectNotType<any>(FilterListConverter.convertToAdg);
expectNotType<any>(NewRuleGenerator.generate);
expectNotType<any>(NewCosmeticRuleGenerator.generate);

console.log('Smoke test passed in index.test-d.ts');
