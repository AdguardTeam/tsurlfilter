import { describe, expect, it } from 'vitest';

import { DomainsLookupTable } from '../../../src/engine/lookup-tables/domains-lookup-table';
import { HostnameLookupTable } from '../../../src/engine/lookup-tables/hostname-lookup-table';
import { getRuleTable, RuleTable } from '../../../src/engine/lookup-tables/rule-table';
import { TrieLookupTable } from '../../../src/engine/lookup-tables/trie-lookup-table';
import { getRuleParts, type NetworkRuleParts } from '../../../src/filterlist/rule-parts';
import { NetworkRule } from '../../../src/rules/network-rule';

import { createRuleStorage } from './lookup-table';

describe('getRuleTable', () => {
    it('keeps the enum values the baked artifacts depend on', () => {
        // The numbers travel into the gate entries and the page-side walk
        // compares them in this order, while `NetworkEngine` walks its tables
        // in the source order. Reordering the members must fail here, not in
        // the page.
        expect([
            RuleTable.Hostname,
            RuleTable.Shortcut,
            RuleTable.Domains,
            RuleTable.Seqscan,
        ]).toEqual([0, 1, 2, 3]);
    });

    it.each([
        // `||host^` and `||host/path` are keyed by hostname.
        ['||example.org^', RuleTable.Hostname],
        ['||example.org/path', RuleTable.Hostname],
        ['||sub.example.org^$document', RuleTable.Hostname],
        // A `$domain` modifier does not move the rule: the table is chosen by
        // the pattern before the domains are looked at.
        ['||example.org^$domain=~example.com', RuleTable.Hostname],
        ['||example.org^$domain=example.*', RuleTable.Hostname],
        // Unusable hostname (wildcard, no dot) falls through to the shortcut.
        ['||example.*^', RuleTable.Shortcut],
        ['||localhost^', RuleTable.Shortcut],
        ['youtube.com/feed', RuleTable.Shortcut],
        ['@@youtube.com/feed$jsinject', RuleTable.Shortcut],
        // No indexable shortcut, but a positive `$domain` list without
        // wildcards or regexes.
        ['@@/\\d+$/$jsinject,domain=youtube.com', RuleTable.Domains],
        ['@@/\\d+$/$document,domain=example.org|youtube.com', RuleTable.Domains],
        // No shortcut and no usable `$domain`.
        ['@@/\\d+$/$jsinject', RuleTable.Seqscan],
        ['@@/\\d+$/$jsinject,domain=~example.com', RuleTable.Seqscan],
        ['@@/\\d+$/$jsinject,domain=example.*', RuleTable.Seqscan],
        // A regex `$domain` with an escaped separator is one value, not two:
        // a raw split would leave pieces that no longer look like a regex and
        // send the rule to the domains table, where it never matches.
        ['@@/\\d+$/$jsinject,domain=/a\\|b/', RuleTable.Seqscan],
        ['@@$document,domain=/patron(live\\|futbol\\|hd)\\d+\\.cfd$/', RuleTable.Seqscan],
    ])('places %s into the %s table', (ruleText, expected) => {
        const rule = new NetworkRule(ruleText, 1);

        expect(getRuleTable(rule)).toBe(expected);
    });

    it('agrees with the lookup tables on the real routing', () => {
        // The predicates live in the tables themselves, so `accepts()` and
        // `addRule()` cannot drift apart. This pins it: every rule the engine
        // adds to a table must be reported by the matching predicate and by
        // `getRuleTable()`.
        const ruleTexts = [
            '||example.org^',
            '||example.org/path',
            '||example.*^',
            '||localhost^',
            'youtube.com/feed',
            '@@youtube.com/feed$jsinject',
            '@@/\\d+$/$jsinject',
            '@@/\\d+$/$jsinject,domain=youtube.com',
            '@@/\\d+$/$jsinject,domain=~example.com',
            '@@/\\d+$/$jsinject,domain=/a\\|b/',
            '@@$document,domain=/patron(live\\|futbol\\|hd)\\d+\\.cfd$/',
        ];

        for (const ruleText of ruleTexts) {
            const ruleParts = getRuleParts(ruleText) as NetworkRuleParts;
            const rule = new NetworkRule(ruleText, 1);

            const storage = createRuleStorage([ruleText]);

            const hostnameTable = new HostnameLookupTable(storage);
            const shortcutTable = new TrieLookupTable(storage);
            const domainsTable = new DomainsLookupTable(storage);

            const domains = [
                ...(rule.getPermittedDomains() ?? []),
                ...(rule.getRestrictedDomains() ?? []).map((domain) => `~${domain}`),
            ];

            expect(hostnameTable.addRule(ruleParts, 0))
                .toBe(HostnameLookupTable.accepts(rule.getPattern()));
            expect(shortcutTable.addRule(ruleParts, 0))
                .toBe(TrieLookupTable.accepts(rule.getPattern()));
            expect(domainsTable.addRule(ruleParts, 0))
                .toBe(DomainsLookupTable.accepts(domains));
        }
    });
});
