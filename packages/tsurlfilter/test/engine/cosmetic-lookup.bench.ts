/* eslint-disable max-len */
// pnpm vitest bench network-lookup
import { bench, describe, vi } from 'vitest';

import { readFileSync } from 'node:fs';
import { RuleParser } from '@adguard/agtree';
import { setLogger } from '../../src/utils/logger';
import { CosmeticRule, RuleFactory, RuleStorage } from '../../src';
import { tokenize } from '../../src/engine-1/tokenize';
import { CosmeticEngine as OldCosmeticEngine } from '../../src/engine/cosmetic-engine/cosmetic-engine';
import { CosmeticEngine as NewCosmeticEngine } from '../../src/engine-1/cosmetic-engine/cosmetic-engine';

describe('Build cosmetics engine', () => {
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
        return ruleData instanceof CosmeticRule;
    });

    bench('adding rules to old cosmetic engine (agtree parse -> rule instance)', () => {
        const engine = new OldCosmeticEngine(new RuleStorage([]), true);
        networkRules.forEach((rule) => {
            engine.addRule(RuleFactory.createRule(RuleParser.parse(rule), 0) as CosmeticRule, 0);
        });
    });

    bench('adding rules to new cosmetic engine (tokenize without creating rule instance)', () => {
        const engine = new NewCosmeticEngine(new RuleStorage([]), true);
        networkRules.forEach((rule) => {
            engine.addRule(tokenize(rule)!, 0);
        });
    });
});
