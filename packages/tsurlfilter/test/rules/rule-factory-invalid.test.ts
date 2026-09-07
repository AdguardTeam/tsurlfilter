import { describe, expect, it } from 'vitest';

import { RuleFactory } from '../../src/rules/rule-factory';

describe('RuleFactory invalid/edge parity', () => {
    const shouldBeNull = [
        '',
        '   ',
        '! comment',
        '# hostlike but comment',
        '!#include something',
        'invalid rule syntax with spaces',
    ];

    it.each(shouldBeNull)('returns null for %j', (rule) => {
        expect(RuleFactory.createRule(rule, 0)).toBeNull();
    });

    const shouldBeRules = [
        '||example.org^',
        'example.com##.ad',
        '127.0.0.1 tracker.com',
    ];

    it.each(shouldBeRules)('returns a rule for %j', (rule) => {
        expect(RuleFactory.createRule(rule, 0)).not.toBeNull();
    });
});
