import { COMMA } from '../../../src/utils/constants';
import { NodeExpectContext, type NodeExpectFn } from '../../helpers/node-utils';
import { AdblockSyntaxError } from '../../../src/errors/adblock-syntax-error';
import { UboParameterListParser } from '../../../src/parser/misc/ubo-parameter-list-parser';
import { defaultParserOptions } from '../../../src/parser/options';

describe('UboParameterListParser', () => {
    // valid cases are tested in `../cosmetic/body/ubo-scriptlet.test.ts`

    describe('UboParameterListParser.parse - invalid cases when requireQuotes enabled', () => {
        test.each<{ actual: string; expected: NodeExpectFn<AdblockSyntaxError> }>([
            {
                actual: String.raw`abc`,
                //                 ~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        "Expected quote, got: 'a'",
                        ...context.toTuple(context.getFullRange()),
                    );
                },
            },
            {
                actual: String.raw`'abc`,
                //                  ~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        'Expected closing quote, got end of string',
                        ...context.toTuple(context.getFullRange()),
                    );
                },
            },
            {
                actual: String.raw`'abc,`,
                //                  ~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        'Expected closing quote, got end of string',
                        ...context.toTuple(context.getFullRange()),
                    );
                },
            },
            {
                actual: String.raw`'abc', 'aaa`,
                //                        ~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        'Expected closing quote, got end of string',
                        ...context.toTuple(context.getRangeFor(String.raw`'aaa`)),
                    );
                },
            },
            {
                actual: String.raw`'abc', bbb`,
                //                        ~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        "Expected quote, got: 'b'",
                        ...context.toTuple(context.getRangeFor(String.raw`bbb`)),
                    );
                },
            },
        ])("should throw on input: '$actual'", ({ actual, expected: expectedFn }) => {
            const fn = jest.fn(() => UboParameterListParser.parse(actual, defaultParserOptions, 0, COMMA, true));

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
});
