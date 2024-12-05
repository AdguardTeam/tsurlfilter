import {
    RuleParser,
    RuleSerializer,
    RuleGenerator,
    RuleDeserializer,
    modifiersCompatibilityTable,
    SpecificPlatform,
    OutputByteBuffer,
    AnyRule,
    InputByteBuffer,
} from '@adguard/agtree';
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

const modifierData = modifiersCompatibilityTable.getSingle('third-party', SpecificPlatform.AdgExtChrome);

ok(modifierData);

console.log('Smoke test passed in root-exports.ts');
