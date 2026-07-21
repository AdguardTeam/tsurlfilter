import { describe, expect, test } from 'vitest';

import { ParameterGenerator } from '../../../src/generator-new/misc/parameter-generator';
import { NodeType, type Parameter } from '../../../src/nodes-new';
import { QuoteType } from '../../../src/utils/quotes';

const makeParam = (value: string, quoteType: QuoteType): Parameter => ({
    type: NodeType.Parameter,
    value,
    quoteType,
});

describe('ParameterGenerator', () => {
    test('emits clean value verbatim when unquoted', () => {
        expect(ParameterGenerator.generate(makeParam('abc', QuoteType.None))).toBe('abc');
    });

    test.each([
        { value: 'abc', quoteType: QuoteType.Single, expected: "'abc'" },
        { value: 'abc', quoteType: QuoteType.Double, expected: '"abc"' },
        { value: 'abc', quoteType: QuoteType.Backtick, expected: '`abc`' },
    ])('wraps clean value $value with $quoteType quotes', ({ value, quoteType, expected }) => {
        expect(ParameterGenerator.generate(makeParam(value, quoteType))).toBe(expected);
    });

    // The node contract says `value` is already unquoted, so a semantic value
    // that happens to contain the outer quote characters must be escaped and
    // wrapped — not reinterpreted as already-quoted syntax and stripped.
    test('preserves a value that starts and ends with the delimiter', () => {
        expect(ParameterGenerator.generate(makeParam("'abc'", QuoteType.Single))).toBe("'\\'abc\\''");
    });

    test('escapes only unescaped occurrences of the selected delimiter', () => {
        expect(ParameterGenerator.generate(makeParam('a"b"c', QuoteType.Double))).toBe('"a\\"b\\"c"');
    });

    test('does not escape a different quote character', () => {
        expect(ParameterGenerator.generate(makeParam('a\'b', QuoteType.Double))).toBe('"a\'b"');
    });
});
