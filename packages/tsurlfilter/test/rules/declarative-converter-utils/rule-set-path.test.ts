import { describe, expect, it } from 'vitest';

import { extractRuleSetId } from '../../../src/rules/declarative-converter-utils';

describe('Ruleset path', () => {
    describe('extractRuleSetId', () => {
        it.each([
            ['ruleset_1', 1],
            ['ruleset_1.json', 1],
            ['1', 1],
            ['1.json', null],
            ['ruleset_01', 1],
            ['foo', null],
            ['ruleset_', null],
            ['ruleset_1_', null],
            ['ruleset_1_2', null],
            ['ruleset_3.14', null],

            // works with path
            ['path/to/ruleset_1', 1],
            ['path/to/ruleset_1.json', 1],
            ['path/to/1', 1],
            ['path/to/1.json', null],
            ['path/to/ruleset_01', 1],
            ['path/to/ruleset_3.14', null],
            ['path/to/ruleset_', null],
            ['path/to/ruleset_1_', null],
            ['path/to/ruleset_1_2', null],
        ])('extracts rule set id from %s', (input, expected) => {
            expect(extractRuleSetId(input)).toStrictEqual(expected);
        });
    });
});
