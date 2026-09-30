import { describe, expect, it } from 'vitest';

import { NETWORK_RULE_OPTIONS } from '@adguard/tsurlfilter';

import { OPTION_NAMES } from '../../src/rule/option-names';
import { VALUE_BEARING_MODIFIERS } from '../../src/rule/rule-badfilter';

/**
 * Modifiers that carry no value: their presence is compared via option flags.
 */
const VALUE_LESS_MODIFIERS = new Set<string>([
    OPTION_NAMES.THIRD_PARTY,
    OPTION_NAMES.FIRST_PARTY,
    OPTION_NAMES.MATCH_CASE,
    OPTION_NAMES.IMPORTANT,
    OPTION_NAMES.ELEMHIDE,
    OPTION_NAMES.GENERICHIDE,
    OPTION_NAMES.SPECIFICHIDE,
    OPTION_NAMES.GENERICBLOCK,
    OPTION_NAMES.JSINJECT,
    OPTION_NAMES.URLBLOCK,
    OPTION_NAMES.CONTENT,
    OPTION_NAMES.DOCUMENT,
    OPTION_NAMES.DOC,
    OPTION_NAMES.POPUP,
    OPTION_NAMES.EMPTY,
    OPTION_NAMES.MP4,
    OPTION_NAMES.SCRIPT,
    OPTION_NAMES.STYLESHEET,
    OPTION_NAMES.SUBDOCUMENT,
    OPTION_NAMES.OBJECT,
    OPTION_NAMES.IMAGE,
    OPTION_NAMES.XMLHTTPREQUEST,
    OPTION_NAMES.MEDIA,
    OPTION_NAMES.FONT,
    OPTION_NAMES.WEBSOCKET,
    OPTION_NAMES.WEBRTC,
    OPTION_NAMES.OTHER,
    OPTION_NAMES.PING,
    OPTION_NAMES.BADFILTER,
    OPTION_NAMES.NETWORK,
    OPTION_NAMES.EXTENSION,
    OPTION_NAMES.NOOP,
    OPTION_NAMES.ALL,
]);

/**
 * Modifiers whose value is compared separately, with domain-specific normalization.
 */
const SEPARATELY_COMPARED_MODIFIERS = new Set<string>([
    OPTION_NAMES.DOMAIN,
    OPTION_NAMES.DENYALLOW,
]);

/**
 * All classification buckets a modifier name may belong to.
 */
const BUCKETS: ReadonlySet<string>[] = [
    VALUE_BEARING_MODIFIERS,
    VALUE_LESS_MODIFIERS,
    SEPARATELY_COMPARED_MODIFIERS,
];

describe('modifier classification for $badfilter comparison', () => {
    // A new modifier must be classified here. An unclassified value-bearing
    // modifier is compared by presence only, and `$badfilter` would start
    // negating rules with a different value of it.
    it('classifies every modifier into exactly one bucket', () => {
        const misclassified = Object.values(OPTION_NAMES)
            .filter((name) => BUCKETS.filter((bucket) => bucket.has(name)).length !== 1);

        expect(misclassified).toEqual([]);
    });

    it('contains no names unknown to OPTION_NAMES', () => {
        const known = new Set<string>(Object.values(OPTION_NAMES));
        const unknown = BUCKETS
            .flatMap((bucket) => [...bucket])
            .filter((name) => !known.has(name));

        expect(unknown).toEqual([]);
    });
});

describe('cross-package modifier coverage', () => {
    // The converter must know every modifier name the MV2 engine supports:
    // otherwise a modifier added to MV2 becomes an unknown modifier here, and
    // the rule is dropped on one engine only.
    it('knows every modifier name of the MV2 engine', () => {
        const known = new Set<string>(Object.values(OPTION_NAMES));
        const missing = Object.values(NETWORK_RULE_OPTIONS)
            .filter((name) => !known.has(name));

        expect(missing).toEqual([]);
    });
});
