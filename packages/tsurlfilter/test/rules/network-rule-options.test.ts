import { describe, expect, it } from 'vitest';

import { NETWORK_RULE_OPTIONS, VALUE_BEARING_OPTIONS } from '../../src/rules/network-rule-options';

/**
 * Modifiers that carry no value: their presence is compared via option flags.
 */
const VALUE_LESS_OPTIONS = new Set<string>([
    NETWORK_RULE_OPTIONS.THIRD_PARTY,
    NETWORK_RULE_OPTIONS.FIRST_PARTY,
    NETWORK_RULE_OPTIONS.MATCH_CASE,
    NETWORK_RULE_OPTIONS.IMPORTANT,
    NETWORK_RULE_OPTIONS.ELEMHIDE,
    NETWORK_RULE_OPTIONS.GENERICHIDE,
    NETWORK_RULE_OPTIONS.SPECIFICHIDE,
    NETWORK_RULE_OPTIONS.GENERICBLOCK,
    NETWORK_RULE_OPTIONS.JSINJECT,
    NETWORK_RULE_OPTIONS.URLBLOCK,
    NETWORK_RULE_OPTIONS.CONTENT,
    NETWORK_RULE_OPTIONS.DOCUMENT,
    NETWORK_RULE_OPTIONS.DOC,
    NETWORK_RULE_OPTIONS.POPUP,
    NETWORK_RULE_OPTIONS.EMPTY,
    NETWORK_RULE_OPTIONS.MP4,
    NETWORK_RULE_OPTIONS.SCRIPT,
    NETWORK_RULE_OPTIONS.STYLESHEET,
    NETWORK_RULE_OPTIONS.SUBDOCUMENT,
    NETWORK_RULE_OPTIONS.OBJECT,
    NETWORK_RULE_OPTIONS.IMAGE,
    NETWORK_RULE_OPTIONS.XMLHTTPREQUEST,
    NETWORK_RULE_OPTIONS.MEDIA,
    NETWORK_RULE_OPTIONS.FONT,
    NETWORK_RULE_OPTIONS.WEBSOCKET,
    NETWORK_RULE_OPTIONS.OTHER,
    NETWORK_RULE_OPTIONS.PING,
    NETWORK_RULE_OPTIONS.BADFILTER,
    NETWORK_RULE_OPTIONS.NETWORK,
    NETWORK_RULE_OPTIONS.EXTENSION,
    NETWORK_RULE_OPTIONS.NOOP,
    NETWORK_RULE_OPTIONS.ALL,
]);

/**
 * Modifiers whose value is compared separately, with domain-specific normalization.
 */
const SEPARATELY_COMPARED_OPTIONS = new Set<string>([
    NETWORK_RULE_OPTIONS.DOMAIN,
    NETWORK_RULE_OPTIONS.DENYALLOW,
]);

/**
 * All classification buckets a modifier name may belong to.
 */
const BUCKETS: ReadonlySet<string>[] = [
    VALUE_BEARING_OPTIONS,
    VALUE_LESS_OPTIONS,
    SEPARATELY_COMPARED_OPTIONS,
];

describe('network rule option classification', () => {
    // A new modifier must be classified here. An unclassified value-bearing
    // modifier is compared by presence only, and `$badfilter` would start
    // negating rules with a different value of it.
    it('classifies every modifier into exactly one bucket', () => {
        const misclassified = Object.values(NETWORK_RULE_OPTIONS)
            .filter((name) => BUCKETS.filter((bucket) => bucket.has(name)).length !== 1);

        expect(misclassified).toEqual([]);
    });

    it('contains no names unknown to NETWORK_RULE_OPTIONS', () => {
        const known = new Set<string>(Object.values(NETWORK_RULE_OPTIONS));
        const unknown = BUCKETS
            .flatMap((bucket) => [...bucket])
            .filter((name) => !known.has(name));

        expect(unknown).toEqual([]);
    });
});
