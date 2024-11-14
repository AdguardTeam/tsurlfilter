import { AnyRule } from '@adguard/agtree';
import { RuleParser } from '@adguard/agtree/parser';
import { OutputByteBuffer, InputByteBuffer  } from '@adguard/agtree/utils';
import { RuleSerializer  } from '@adguard/agtree/serializer';
import { RuleDeserializer  } from '@adguard/agtree/deserializer';
import { CosmeticRuleGenerator, RuleGenerator } from '@adguard/agtree/generator';
import { ok } from 'assert';

const ruleText = '||example.com^';
const ruleNode = RuleParser.parse(ruleText);

const outBuffer = new OutputByteBuffer();
RuleSerializer.serialize(ruleNode, outBuffer);

const inBuffer = new InputByteBuffer(outBuffer.getChunks());

const deserializedRuleNode = {} as AnyRule;
RuleDeserializer.deserialize(inBuffer, deserializedRuleNode);

const generatedRuleText = RuleGenerator.generate(deserializedRuleNode);

ok(generatedRuleText === ruleText);

ok(CosmeticRuleGenerator);

console.log('Smoke test passed in specific-exports.ts');
