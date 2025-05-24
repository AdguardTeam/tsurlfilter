import {
    describe,
    test,
    expect,
    vi,
} from 'vitest';

import { AdblockSyntaxError } from '../../src/errors/adblock-syntax-error.js';
import { RuleParser } from '../../src/parser/rule-parser.js';
import { NodeExpectContext, type NodeExpectFn } from '../helpers/node-utils.js';
import { defaultParserOptions } from '../../src/parser/options.js';

describe('Toggleable syntax', () => {
    describe('RuleParser.parse - handle if uBO syntax is disabled', () => {
        test.each<{ actual: string; expected: NodeExpectFn<AdblockSyntaxError> }>([
            {
                actual: String.raw`##+js(scriptlet0, arg0)`,
                //                   ~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        "Parsing 'UblockOrigin' syntax is disabled, but the rule uses it",
                        ...context.toTuple(context.getRangeFor('+js(scriptlet0, arg0)')),
                    );
                },
            },
            {
                actual: String.raw`##^script:has-text(foo)`,
                //                   ~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        "Parsing 'UblockOrigin' syntax is disabled, but the rule uses it",
                        ...context.toTuple(context.getRangeFor('^script:has-text(foo)')),
                    );
                },
            },
            {
                actual: String.raw`#@#+js(scriptlet0, arg0)`,
                //                    ~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        "Parsing 'UblockOrigin' syntax is disabled, but the rule uses it",
                        ...context.toTuple(context.getRangeFor('+js(scriptlet0, arg0)')),
                    );
                },
            },
            {
                actual: String.raw`#@#^script:has-text(foo)`,
                //                    ~~~~~~~~~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        "Parsing 'UblockOrigin' syntax is disabled, but the rule uses it",
                        ...context.toTuple(context.getRangeFor('^script:has-text(foo)')),
                    );
                },
            },
        ])("should throw on input: '$actual'", ({ actual, expected: expectedFn }) => {
            const fn = vi.fn(() => RuleParser.parse(actual, {
                ...defaultParserOptions,
                parseUboSpecificRules: false,
            }));

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

    describe('RuleParser.parse - handle if ABP syntax is disabled', () => {
        test.each<{ actual: string; expected: NodeExpectFn<AdblockSyntaxError> }>([
            {
                actual: String.raw`#$#snippet0 arg0`,
                //                    ~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        "Parsing 'AdblockPlus' syntax is disabled, but the rule uses it",
                        ...context.toTuple(context.getRangeFor('snippet0 arg0')),
                    );
                },
            },
            {
                actual: String.raw`#@$#snippet0 arg0`,
                //                     ~~~~~~~~~~~~~
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        "Parsing 'AdblockPlus' syntax is disabled, but the rule uses it",
                        ...context.toTuple(context.getRangeFor('snippet0 arg0')),
                    );
                },
            },
        ])("should throw on input: '$actual'", ({ actual, expected: expectedFn }) => {
            const fn = vi.fn(() => RuleParser.parse(actual, {
                ...defaultParserOptions,
                parseAbpSpecificRules: false,
            }));

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
