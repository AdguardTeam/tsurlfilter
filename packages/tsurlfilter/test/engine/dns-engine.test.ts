import escapeStringRegexp from 'escape-string-regexp';
import { describe, expect, it } from 'vitest';

import { DnsEngine } from '../../src/engine/dns-engine';
import { BufferRuleList } from '../../src/filterlist/buffer-rule-list';
import { FilterListPreprocessor, type PreprocessedFilterList } from '../../src/filterlist/preprocessor';
import { RuleStorage } from '../../src/filterlist/rule-storage';
import { getRuleSourceIndex } from '../../src/filterlist/source-map';

describe('General DNS engine tests', () => {
    /**
     * Helper function creates rule storage.
     *
     * @param listId Filter list ID.
     * @param processed Preprocessed filter list.
     *
     * @returns RuleStorage instance.
     */
    const createTestRuleStorage = (listId: number, processed: PreprocessedFilterList): RuleStorage => {
        const list = new BufferRuleList(listId, processed.filterList, false, false, false, processed.sourceMap);
        return new RuleStorage([list]);
    };

    /**
     * Helper function to get the rule index from the raw filter list by the rule text.
     *
     * @param rawFilterList Raw filter list.
     * @param rule Rule text.
     *
     * @returns Rule index or -1 if the rule couldn't be found.
     */
    const getRawRuleIndex = (rawFilterList: string, rule: string): number => {
        return rawFilterList.search(new RegExp(`^${escapeStringRegexp(rule)}$`, 'm'));
    };

    it('works if empty engine is ok', () => {
        const engine = new DnsEngine(createTestRuleStorage(1, FilterListPreprocessor.preprocess('', true)));
        const result = engine.match('example.org');

        expect(result).not.toBeNull();
        expect(result.basicRule).toBeNull();
        expect(result.hostRules).toHaveLength(0);
    });

    it('checks engine match', () => {
        const rules = [
            '||example.org^',
            '||example2.org/*',
            '@@||example3.org^',
            '0.0.0.0 v4.com',
            '127.0.0.1 v4.com',
            ':: v6.com',
            '127.0.0.1 v4and6.com',
            '127.0.0.2 v4and6.com',
            '::1 v4and6.com',
            '::2 v4and6.com',
        ];
        const processed = FilterListPreprocessor.preprocess(rules.join('\n'), true);
        const engine = new DnsEngine(createTestRuleStorage(1, processed));

        let result;

        result = engine.match('example.org');
        expect(result.basicRule).not.toBeNull();
        expect(
            getRuleSourceIndex(result.basicRule!.getIndex(), processed.sourceMap),
        ).toBe(
            getRawRuleIndex(processed.rawFilterList, '||example.org^'),
        );
        expect(result.hostRules).toHaveLength(0);

        result = engine.match('example2.org');
        expect(result.basicRule).not.toBeNull();
        expect(
            getRuleSourceIndex(result.basicRule!.getIndex(), processed.sourceMap),
        ).toBe(
            getRawRuleIndex(processed.rawFilterList, '||example2.org/*'),
        );
        expect(result.hostRules).toHaveLength(0);

        result = engine.match('example3.org');
        expect(result.basicRule).not.toBeNull();
        expect(
            getRuleSourceIndex(result.basicRule!.getIndex(), processed.sourceMap),
        ).toBe(
            getRawRuleIndex(processed.rawFilterList, '@@||example3.org^'),
        );
        expect(result.hostRules).toHaveLength(0);

        result = engine.match('v4.com');
        expect(result.basicRule).toBeNull();
        expect(result.hostRules).toHaveLength(2);
        expect(
            getRuleSourceIndex(result.hostRules[0].getIndex(), processed.sourceMap),
        ).toBe(
            getRawRuleIndex(processed.rawFilterList, '0.0.0.0 v4.com'),
        );
        expect(
            getRuleSourceIndex(result.hostRules[1].getIndex(), processed.sourceMap),
        ).toBe(
            getRawRuleIndex(processed.rawFilterList, '127.0.0.1 v4.com'),
        );

        result = engine.match('v6.com');
        expect(result.basicRule).toBeNull();
        expect(result.hostRules).toHaveLength(1);
        expect(
            getRuleSourceIndex(result.hostRules[0].getIndex(), processed.sourceMap),
        ).toBe(
            getRawRuleIndex(processed.rawFilterList, ':: v6.com'),
        );

        result = engine.match('v4and6.com');
        expect(result.basicRule).toBeNull();
        expect(result.hostRules).toHaveLength(4);
        expect(
            getRuleSourceIndex(result.hostRules[0].getIndex(), processed.sourceMap),
        ).toBe(
            getRawRuleIndex(processed.rawFilterList, '127.0.0.1 v4and6.com'),
        );
        expect(
            getRuleSourceIndex(result.hostRules[1].getIndex(), processed.sourceMap),
        ).toBe(
            getRawRuleIndex(processed.rawFilterList, '127.0.0.2 v4and6.com'),
        );
        expect(
            getRuleSourceIndex(result.hostRules[2].getIndex(), processed.sourceMap),
        ).toBe(
            getRawRuleIndex(processed.rawFilterList, '::1 v4and6.com'),
        );
        expect(
            getRuleSourceIndex(result.hostRules[3].getIndex(), processed.sourceMap),
        ).toBe(
            getRawRuleIndex(processed.rawFilterList, '::2 v4and6.com'),
        );

        result = engine.match('example.net');
        expect(result.basicRule).toBeNull();
        expect(result.hostRules).toHaveLength(0);
    });

    it('checks match for host level network rule - protocol', () => {
        const rules = [
            '://example.org',
        ];
        const processed = FilterListPreprocessor.preprocess(rules.join('\n'), true);
        const engine = new DnsEngine(createTestRuleStorage(1, processed));

        const result = engine.match('example.org');
        expect(result.basicRule).not.toBeNull();
        expect(result.hostRules).toHaveLength(0);
    });

    it('checks match for host level network rule - regex', () => {
        const rules = [
            '/^stats?\\./',
        ];
        const processed = FilterListPreprocessor.preprocess(rules.join('\n'), true);
        const engine = new DnsEngine(createTestRuleStorage(1, processed));

        const result = engine.match('stats.test.com');
        expect(result.basicRule).not.toBeNull();
        expect(result.hostRules).toHaveLength(0);
    });

    it('checks match for host level network rule - regex allowlist', () => {
        const rules = [
            '||stats.test.com^',
            '@@/stats?\\./',
        ];
        const processed = FilterListPreprocessor.preprocess(rules.join('\n'), true);
        const engine = new DnsEngine(createTestRuleStorage(1, processed));

        const result = engine.match('stats.test.com');
        expect(result.basicRule).not.toBeNull();
        expect(result.basicRule!.isAllowlist()).toBeTruthy();
        expect(result.hostRules).toHaveLength(0);
    });

    it('checks match for badfilter rules', () => {
        const rules = [
            '||example.org^',
            '||example.org^$badfilter',
        ];
        const processed = FilterListPreprocessor.preprocess(rules.join('\n'), true);
        const engine = new DnsEngine(createTestRuleStorage(1, processed));

        const result = engine.match('example.org');
        expect(result.basicRule).toBeNull();
        expect(result.hostRules).toHaveLength(0);
    });

    it('checks match for dnsrewrite rules', () => {
        const rules = [
            '||example.org^',
            '||example.org^$dnsrewrite=1.2.3.4',
        ];
        const processed = FilterListPreprocessor.preprocess(rules.join('\n'), true);
        const engine = new DnsEngine(createTestRuleStorage(1, processed));

        const result = engine.match('example.org');
        expect(result.basicRule).not.toBeNull();
        expect(result.basicRule!.getAdvancedModifier()).not.toBeNull();
        expect(result.hostRules).toHaveLength(0);
    });
});
