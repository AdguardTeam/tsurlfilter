import { describe, expect, it } from 'vitest';

import { type DeclarativeRule, RuleActionType } from '../../../src/declarative-rule';
import { InvalidMetadataChunksError } from '../../../src/errors/metadata-errors';
import { parseCompactRuleset } from '../../../src/ruleset/compact-ruleset';
import { MetadataRules } from '../../../src/ruleset/metadata-rule';
import { type CompactRulesetEnvelope } from '../../../src/ruleset/ruleset-with-source-map';

const envelope: CompactRulesetEnvelope = {
    metadata: {
        regexpRulesCount: 0,
        unsafeRulesCount: 0,
        safeRulesCount: 1,
        rulesetHashMapRaw: '[]',
        badFilterRulesRaw: [],
        unsafeRules: [],
    },
    lazyMetadata: {
        sourceMapRaw: '[]',
        filterIds: [1],
    },
    // Large enough for several chunks.
    filterContent: '||example.com^\n'.repeat(10_000),
};

const ordinaryRule: DeclarativeRule = {
    id: 42,
    action: { type: RuleActionType.Block },
    condition: { urlFilter: '||example.com^' },
};

describe('parseCompactRuleset', () => {
    it('returns the envelope, ordinary rules and metadata rule count', () => {
        const metadataRules = MetadataRules.create(envelope, new Set([42]), false);
        expect(metadataRules.length).toBeGreaterThan(1);

        const content = parseCompactRuleset('ruleset_1', [...metadataRules, ordinaryRule]);

        expect(content).toEqual({
            ...envelope,
            declarativeRules: [ordinaryRule],
            metadataRulesCount: metadataRules.length,
        });
    });

    it('reads a file that went through pretty-printed JSON text', () => {
        const text = JSON.stringify([...MetadataRules.create(envelope, new Set(), true), ordinaryRule], null, '\t');

        const content = parseCompactRuleset('ruleset_1', JSON.parse(text));

        expect(content.filterContent).toBe(envelope.filterContent);
        expect(content.declarativeRules).toEqual([ordinaryRule]);
    });

    it('accepts a ruleset without ordinary rules', () => {
        const content = parseCompactRuleset('ruleset_1', MetadataRules.create(envelope, new Set(), false));

        expect(content.declarativeRules).toEqual([]);
        expect(content.metadataRulesCount).toBeGreaterThan(0);
    });

    it('propagates chunk-layer errors', () => {
        expect(() => parseCompactRuleset('ruleset_1', [ordinaryRule])).toThrow(InvalidMetadataChunksError);
        expect(() => parseCompactRuleset('ruleset_1', 'not an array')).toThrow(InvalidMetadataChunksError);
    });
});
