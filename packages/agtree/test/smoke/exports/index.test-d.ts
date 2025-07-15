import { expectNotType } from 'tsd';

import { RuleParser } from '@adguard/agtree/parser';
import { OutputByteBuffer, InputByteBuffer  } from '@adguard/agtree/utils';
import { RuleSerializer  } from '@adguard/agtree/serializer';
import { RuleDeserializer  } from '@adguard/agtree/deserializer';
import { CosmeticRuleGenerator, RuleGenerator } from '@adguard/agtree/generator';

expectNotType<any>(RuleParser.parse);
expectNotType<any>(RuleSerializer.serialize);
expectNotType<any>(RuleDeserializer.deserialize);
expectNotType<any>(RuleGenerator.generate);
expectNotType<any>(CosmeticRuleGenerator.generate);
expectNotType<any>(OutputByteBuffer);
expectNotType<any>(InputByteBuffer);

console.log('Smoke test passed in index.test-d.ts');
