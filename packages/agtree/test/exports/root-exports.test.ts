/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
    RuleParser,
    RuleSerializer,
    RuleDeserializer,
    RuleGenerator,
    OutputByteBuffer,
    InputByteBuffer,
    type AnyNode,
// @ts-ignore
} from '@adguard/agtree';

describe('root exports', () => {
    it('RuleParser, OutputByteBuffer, RuleSerializer, InputByteBuffer, RuleDeserializer, RuleGenerator', async () => {
        const ruleString = '||example.org^';
        const ruleNode = RuleParser.parse(ruleString);
        const outputByteBuffer = new OutputByteBuffer();

        RuleSerializer.serialize(ruleNode, outputByteBuffer);

        const inputBuffer = new InputByteBuffer(outputByteBuffer.chunks);
        const node: AnyNode = {};
        RuleDeserializer.deserialize(inputBuffer, node);

        const outRuleString = RuleGenerator.generate(node);
        expect(outRuleString).toBe(ruleString);
    });
});
