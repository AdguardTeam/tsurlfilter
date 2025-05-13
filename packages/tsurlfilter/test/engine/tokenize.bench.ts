/* eslint-disable max-len */
// pnpm vitest bench tokenize
import {
    bench,
    describe, expect, vi
} from 'vitest';

import { readFileSync } from 'node:fs';
import { setLogger } from '../../src/utils/logger';
import { RuleParser } from '@adguard/agtree';
import { NetworkRule, RuleFactory } from '../../src';
import { tokenize } from '../../src/engine/tokenize';

describe('Get main rule tokens', () => {
    setLogger({
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
    });

    const rawFilter = readFileSync('test/resources/adguard_base_filter.txt', 'utf-8');
    const rawRules = rawFilter.split(/\r?\n/);

    // extracted domains should be equal
    // FIXME: check for cosmetic rules
    const domainsA = new Set();
    const domainsB = new Set();

    rawRules.forEach(rule => {
        const ruleDataA = RuleFactory.createRule(RuleParser.parse(rule), 0);
        if (ruleDataA instanceof NetworkRule) {
            ruleDataA.getRestrictedDomains()?.forEach(domain => domainsA.add(domain));
            ruleDataA.getPermittedDomains()?.forEach(domain => domainsA.add(domain));
        }

        const ruleDataB = tokenize(rule);
        if (ruleDataB && ruleDataB.type === 0) {
            ruleDataB.domains?.forEach(domain => {
                domain.startsWith('~') ? domainsB.add(domain.slice(1)) : domainsB.add(domain);
            });
        }
    });

    expect(domainsA).toEqual(domainsB);

    bench('parse with AGTree and create TSUrlFilter rule instance', () => {
        rawRules.forEach(rule => {
            RuleFactory.createRule(RuleParser.parse(rule), 0);
        });
    });

    bench('fast tokenize', () => {
        rawRules.forEach(rule => {
            tokenize(rule);
        });
    });
});