/* eslint-disable max-len */
// pnpm vitest bench network-lookup
import { bench, describe, vi } from 'vitest';

import { readFileSync } from 'node:fs';
import { RuleParser } from '@adguard/agtree';
import { setLogger } from '../../src/utils/logger';
import { NetworkRule, RuleFactory, RuleStorage } from '../../src';
import { tokenize } from '../../src/engine-1/tokenize';
import { NetworkEngine as OldNetworkEngine } from '../../src/engine/network-engine';
import { NetworkEngine as NewNetworkEngine } from '../../src/engine-1/network-engine';

describe('Build network engine', () => {
    setLogger({
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
    });

    const rawFilter = readFileSync('test/resources/adguard_base_filter.txt', 'utf-8');
    const rawRules = rawFilter.split(/\r?\n/);
    const networkRules = rawRules.filter((rule) => {
        const ruleData = RuleFactory.createRule(RuleParser.parse(rule), 0);
        return ruleData instanceof NetworkRule;
    });

    bench('adding rules to old network engine (agtree parse -> rule instance)', () => {
        const engine = new OldNetworkEngine(new RuleStorage([]), true);
        networkRules.forEach((rule) => {
            engine.addRule(RuleFactory.createRule(RuleParser.parse(rule), 0) as NetworkRule, 0);
        });
    });

    bench('adding rules to new network engine (tokenize without creating rule instance)', () => {
        const engine = new NewNetworkEngine(new RuleStorage([]), true);
        networkRules.forEach((rule) => {
            engine.addRule(tokenize(rule)!, 0);
        });
    });
});
