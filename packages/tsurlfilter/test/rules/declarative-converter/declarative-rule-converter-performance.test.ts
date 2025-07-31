/* eslint-disable no-console */
import { describe, expect, it } from 'vitest';

import { DeclarativeRulesConverter } from '../../../src/rules/declarative-converter/rules-converter';

import { createScannedFilter } from './helpers';

const generateRules = (rulesNumber: number) => {
    const rules = [];
    for (let i = 0; i < rulesNumber; i += 1) {
        rules.push(`example_${i}.com`);
    }
    return rules;
};

describe('test declarative rule converter performance', () => {
    it('tests declarative rule converter performance', async () => {
        const rules = generateRules(300_000);
        const filterId = 1;
        const filter = await createScannedFilter(
            filterId,
            rules,
        );
        const start = performance.now();
        const result = await DeclarativeRulesConverter.convert([filter], { maxNumberOfRules: 5000 });
        const end = performance.now();
        const timePassed = end - start;
        console.log('One filter with 300_000 rules converted in', timePassed, 'ms');
        console.log('For the reference on macos Apple M1 Pro 16 GB it took ~2039 ms');
        expect(timePassed).toBeLessThan(10000);
        expect(result).toBeDefined();
    });
});
