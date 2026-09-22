import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../src/ast-builder/rule-parser';
import { isConversionCandidate } from '../../src/converter/candidate-filter';
import { CONVERTER_PARSE_OPTIONS } from '../../src/converter/parse-options';
import { RawRuleConverter } from '../../src/converter/raw-rule';

const pipeline = new RuleParserPipeline();

const CONVERTIBLE_RULES = [
    'example.com##+js(foo)',
    'example.com#$#bar;baz',
    'example.com##h1:style(color: red)',
    '||example.com^$queryprune=x',
    '||example.com^$1p',
    '||example.com^$empty',
    '# host-style comment',
];

describe('candidate pre-filter soundness', () => {
    test.each(CONVERTIBLE_RULES)('selects convertible rule %j', (rule) => {
        // Ground truth: the AST converter actually changes it.
        const actuallyConverted = RawRuleConverter.convertToAdg(rule).isConverted;
        expect(actuallyConverted).toBe(true);

        // Pre-filter must not under-select it.
        const { kind, ctx } = pipeline.parseStructural(rule, CONVERTER_PARSE_OPTIONS);
        expect(isConversionCandidate(kind, ctx)).toBe(true);
    });
});
