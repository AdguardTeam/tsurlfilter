import {
    describe,
    expect,
    test,
    vi,
} from 'vitest';

import { NodeExpectContext, type NodeExpectFn } from '../../../helpers/node-utils';
import { AdblockSyntaxError, type HtmlFilteringRuleBody } from '../../../../src';
import {
    UboHtmlFilteringBodyParser,
} from '../../../../src/parser/cosmetic/html-filtering-body/ubo-html-filtering-body-parser';
import {
    UboHtmlFilteringBodyGenerator,
} from '../../../../src/generator/cosmetic/html-filtering-body/ubo-html-filtering-body-generator';
import {
    UboHtmlFilteringBodySerializer,
} from '../../../../src/serializer/cosmetic/html-filtering-body/ubo-html-filtering-body-serializer';
import {
    UboHtmlFilteringBodyDeserializer,
} from '../../../../src/deserializer/cosmetic/html-filtering-body/ubo-html-filtering-body-deserializer';

/**
 * Please note that most of the test cases are covered in `html-filtering.test.ts` file,
 * this file is mainly for testing UBO specific cases and ensuring
 * the UBO parser/generator/serializer/deserializer are wired up correctly.
 */
describe('UboHtmlFilteringBodyParser', () => {
    describe('UboHtmlFilteringBodyParser.parse - valid cases', () => {
        test.each<{ actual: string; expected: NodeExpectFn<HtmlFilteringRuleBody> }>([
            // FIXME: Add valid test cases
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            expect(UboHtmlFilteringBodyParser.parse(actual)).toMatchObject(
                expectedFn(new NodeExpectContext(actual)),
            );
        });
    });

    describe('UboHtmlFilteringBodyParser.parse - invalid cases', () => {
        test.each<{ actual: string; expected: NodeExpectFn<AdblockSyntaxError> }>([
            // FIXME: Add invalid test cases
        ])("should throw on input: '$actual'", ({ actual, expected: expectedFn }) => {
            const fn = vi.fn(() => UboHtmlFilteringBodyParser.parse(actual));

            // parse should throw
            expect(fn).toThrow();

            const expected = expectedFn(new NodeExpectContext(actual));

            // check the thrown error
            const error = fn.mock.results[0].value;
            expect(error).toBeInstanceOf(AdblockSyntaxError);
            expect(error).toHaveProperty('message', expected.message);
            expect(error).toHaveProperty('start', expected.start);
            expect(error).toHaveProperty('end', expected.end);
        });
    });

    describe('UboHtmlFilteringBodyGenerator.generate', () => {
        test.each<{ actual: string; expected: string }>([
            // FIXME: Add generation test cases
        ])("should generate '$expected' from '$actual'", ({ actual, expected }) => {
            const ruleNode = UboHtmlFilteringBodyParser.parse(actual);

            if (ruleNode === null) {
                throw new Error(`Failed to parse '${actual}' as cosmetic rule`);
            }

            expect(UboHtmlFilteringBodyGenerator.generate(ruleNode)).toBe(expected);
        });
    });

    describe('serialize & deserialize', () => {
        test.each([
            // FIXME: Add serialization/deserialization test cases
        ])("should serialize and deserialize '%p'", async (input) => {
            await expect(input).toBeSerializedAndDeserializedProperly(
                UboHtmlFilteringBodyParser,
                UboHtmlFilteringBodyGenerator,
                UboHtmlFilteringBodySerializer,
                UboHtmlFilteringBodyDeserializer,
            );
        });
    });
});
