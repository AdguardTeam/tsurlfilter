import { describe, expect, it } from 'vitest';

import { ResourceType, RuleActionType } from '../../../src/declarative-rule';
import { createMetadataRule } from '../../../src/ruleset/metadata-rule';

describe('createMetadataRule', () => {
    it('creates a metadata rule with correct structure', () => {
        const content = { version: '1.0', filterName: 'test' };
        const rule = createMetadataRule(content);

        expect(rule.id).toBe(1);
        expect(rule.action.type).toBe(RuleActionType.Block);
        expect(rule.condition.urlFilter).toBe('dummy.rule.adguard.com');
        expect(rule.condition.resourceTypes).toEqual([ResourceType.XmlHttpRequest]);
    });

    it('attaches metadata content to the rule', () => {
        const content = { key: 'value', nested: { a: 1 } };
        const rule = createMetadataRule(content);

        expect(rule.metadata).toEqual(content);
    });

    it('works with empty metadata content', () => {
        const rule = createMetadataRule({});

        expect(rule.metadata).toEqual({});
        expect(rule.id).toBe(1);
    });
});
