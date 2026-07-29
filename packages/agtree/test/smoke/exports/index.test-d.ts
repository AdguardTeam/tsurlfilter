import { expectNotType } from 'tsd';

import { RuleParserPipeline } from '@adguard/agtree';
import { CosmeticRuleGenerator, RuleGenerator } from '@adguard/agtree/generator';
import { RuleConverter, FilterListConverter } from '@adguard/agtree/converter';

expectNotType<any>(RuleParserPipeline);
expectNotType<any>(RuleGenerator.generate);
expectNotType<any>(CosmeticRuleGenerator.generate);
expectNotType<any>(RuleConverter.convertToAdg);
expectNotType<any>(FilterListConverter.convertToAdg);

console.log('Smoke test passed in index.test-d.ts');
