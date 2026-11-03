import {
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';

import { Engine } from '@adguard/tsurlfilter';

import { ALLOWLIST_FILTER_ID } from '../../../src/lib/common/constants';
import { Allowlist } from '../../../src/lib/mv2/background/allowlist';
import { AllowlistApi } from '../../../src/lib/mv3/background/allowlist-api';
import { createNetworkRule } from '../../helpers/rule-creator';
import { getConfigurationMv2Fixture } from '../mv2/background/fixtures/configuration';
import { getConfigurationMv3Fixture } from '../mv3/fixtures/configuration';

/**
 * Beginning of the rule generated for an entry without the `*.` prefix: the URL start, which
 * makes the domain match the URL host, the optional credentials and the optional `www.`
 * subdomain.
 */
const DOMAIN_RULE_START = String.raw`@@/^(?:https?|wss?):\/\/(?:[^\/\\?#]*@)?(www\.)?`;

/**
 * End of the rule generated for an entry without the `*.` prefix: the host end — an optional root
 * label dot, an optional port, the path, the query, the fragment or the end of the URL — and the
 * modifiers.
 */
const DOMAIN_RULE_END = String.raw`(?:\.)?(?::\d*)?(?:[\/\\?#]|$)/$document,important`;

/**
 * Wildcard of an entry: any characters of the host, but not the authority delimiters.
 */
const DOMAIN_WILDCARD = String.raw`[^\/\\?#@]*`;

/**
 * Beginning of the rule generated for an entry with the `*.` prefix: the URL start and the
 * subdomains, each ending with a dot.
 */
const SUBDOMAIN_RULE_START = String.raw`@@/^(?:https?|wss?):\/\/(?:[^\/\\?#]*@)?(?:[^\/\\?#@.]+\.)*`;

/**
 * Creates an engine with the given allowlist rules, the way the application loads them.
 *
 * @param rules Allowlist rules.
 *
 * @returns Engine with the rules loaded.
 */
const createEngine = (rules: string): Engine => Engine.createSync({
    filters: [{
        id: ALLOWLIST_FILTER_ID,
        content: rules,
    }],
});

/**
 * Creates an engine the way MV3 configures the allowlist for the given entries.
 *
 * @param entries Allowlist entries.
 *
 * @returns Engine with the generated rules.
 */
const createMv3Engine = (entries: string[]): Engine => {
    const config = getConfigurationMv3Fixture();

    config.allowlist = entries;
    config.settings.allowlistEnabled = true;

    const allowlistApi = new AllowlistApi();
    allowlistApi.configure(config);

    return createEngine(allowlistApi.getAllowlistRules() ?? '');
};

describe('Allowlist Api', () => {
    let allowlist: Allowlist;

    beforeEach(() => {
        allowlist = new Allowlist();
    });

    describe('configure method', () => {
        const cases = [
            { input: ['example.com'], expected: ['example.com'] },
            { input: ['EXAMPLE.COM'], expected: ['example.com'] },
            { input: ['  Example.COM \t'], expected: ['example.com'] },
            { input: [' \tWWW.Example.COM\n'], expected: ['example.com'] },
            { input: ['www.example.com'], expected: ['example.com'] },
            { input: ['sub.example.com'], expected: ['sub.example.com'] },
            { input: ['www.sub.example.com'], expected: ['sub.example.com'] },
            { input: ['www.sub.sub.example.com'], expected: ['sub.sub.example.com'] },
        ];

        it.each(cases)('should parse $input to $expected for MV2', ({ input, expected }) => {
            const config = getConfigurationMv2Fixture();

            config.allowlist = input;

            allowlist.configure(config);

            expect(allowlist.domains).toStrictEqual(expected);
        });

        it.each(cases)('should parse $input to $expected for MV3', ({ input, expected }) => {
            const config = getConfigurationMv3Fixture();

            config.allowlist = input;

            allowlist.configure(config);

            expect(allowlist.domains).toStrictEqual(expected);
        });
    });

    describe('getAllowlistRules method', () => {
        const cases = [
            {
                title: 'should return filter list, when API is enabled and  not inverted',
                enabled: true,
                inverted: false,
                expected: `${DOMAIN_RULE_START}example\\.com${DOMAIN_RULE_END}`,
            },
            {
                title: 'should return null, when API is enabled and inverted',
                enabled: true,
                inverted: true,
                expected: null,
            },
            {
                title: 'should return null, when API is disabled and not inverted',
                enabled: false,
                inverted: false,
                expected: null,
            },
            {
                title: 'should return null, when allowlist is disabled and inverted',
                enabled: false,
                inverted: true,
                expected: null,
            },
        ];

        it.each(cases)('$title', ({
            enabled,
            inverted,
            expected,
        }) => {
            const config = getConfigurationMv2Fixture();

            config.allowlist = ['example.com'];
            config.settings.allowlistEnabled = enabled;
            config.settings.allowlistInverted = inverted;

            allowlist.configure(config);

            expect(allowlist.getAllowlistRules()).toStrictEqual(expected);
        });
    });

    describe('static createAllowlistRule method', () => {
        it('should return null, when domain is empty', () => {
            expect(Allowlist.createAllowlistRule('')).toBeNull();
        });

        describe('should return network rule for valid allowlist domain', () => {
            const testCases = [
                {
                    domain: 'example.com',
                    expected: `${DOMAIN_RULE_START}example\\.com${DOMAIN_RULE_END}`,
                },
                {
                    domain: 'sub.example.com',
                    expected: `${DOMAIN_RULE_START}sub\\.example\\.com${DOMAIN_RULE_END}`,
                },
                {
                    domain: 'example.*',
                    expected: `${DOMAIN_RULE_START}example\\.${DOMAIN_WILDCARD}${DOMAIN_RULE_END}`,
                },
                {
                    domain: 'example.*.com',
                    expected: `${DOMAIN_RULE_START}example\\.${DOMAIN_WILDCARD}\\.com${DOMAIN_RULE_END}`,
                },
                {
                    domain: '*.example.com',
                    expected: `${SUBDOMAIN_RULE_START}example\\.com${DOMAIN_RULE_END}`,
                },
                {
                    domain: '*.sub.example.*',
                    expected: `${SUBDOMAIN_RULE_START}sub\\.example\\.${DOMAIN_WILDCARD}${DOMAIN_RULE_END}`,
                },
                {
                    domain: '*example.com',
                    expected: `${DOMAIN_RULE_START}${DOMAIN_WILDCARD}example\\.com${DOMAIN_RULE_END}`,
                },
                {
                    domain: 'example*.com',
                    expected: `${DOMAIN_RULE_START}example${DOMAIN_WILDCARD}\\.com${DOMAIN_RULE_END}`,
                },
                {
                    domain: 'exam*ple.com',
                    expected: `${DOMAIN_RULE_START}exam${DOMAIN_WILDCARD}ple\\.com${DOMAIN_RULE_END}`,
                },
                {
                    domain: '*.example*.com',
                    expected: `${SUBDOMAIN_RULE_START}example${DOMAIN_WILDCARD}\\.com${DOMAIN_RULE_END}`,
                },
            ];

            it.each(testCases)('should return $expected rule for $domain', ({ domain, expected }) => {
                const rule = Allowlist.createAllowlistRule(domain)!;

                expect(rule).not.toBeUndefined();
                expect(rule).toEqual(createNetworkRule(expected, ALLOWLIST_FILTER_ID));
                expect(rule.getFilterListId()).toBe(ALLOWLIST_FILTER_ID);
            });
        });
    });

    describe('getAllowlistRules matching in MV2', () => {
        let engine: Engine;

        beforeAll(() => {
            const config = getConfigurationMv2Fixture();

            config.allowlist = ['example.com'];
            config.settings.allowlistEnabled = true;

            // A local instance: the suite-scoped `allowlist` is created in the outer `beforeEach`,
            // which runs after this hook.
            const mv2Allowlist = new Allowlist();
            mv2Allowlist.configure(config);

            engine = createEngine(mv2Allowlist.getAllowlistRules()!);
        });

        const matchingCases = [
            { url: 'https://example.com/' },
            { url: 'https://example.com:8080/' },
        ];

        it.each(matchingCases)('matches $url', ({ url }) => {
            expect(engine.matchFrame(url)).not.toBeNull();
        });

        const notMatchingCases = [
            { url: 'https://example.community/' },
            { url: 'https://evil.org//example.com/' },
        ];

        it.each(notMatchingCases)('does not match $url', ({ url }) => {
            expect(engine.matchFrame(url)).toBeNull();
        });
    });

    describe('getAllowlistRules matching in MV3', () => {
        let engine: Engine;

        beforeAll(() => {
            const config = getConfigurationMv3Fixture();

            config.allowlist = ['example.com'];
            config.settings.allowlistEnabled = true;

            const allowlistApi = new AllowlistApi();
            allowlistApi.configure(config);

            engine = createEngine(allowlistApi.getAllowlistRules()!);
        });

        const matchingCases = [
            { url: 'https://example.com/' },
            // MV3 adds a `*.` twin for every entry to mirror DNR domain matching.
            { url: 'https://sub.example.com/' },
        ];

        it.each(matchingCases)('matches $url', ({ url }) => {
            expect(engine.matchFrame(url)).not.toBeNull();
        });

        const notMatchingCases = [
            { url: 'https://example.community/' },
            { url: 'https://example.com.evil.org/' },
            { url: 'https://evil.org//example.com/' },
        ];

        it.each(notMatchingCases)('does not match $url', ({ url }) => {
            expect(engine.matchFrame(url)).toBeNull();
        });
    });

    describe('getAllowlistRules matching in MV3 for an entry without a domain', () => {
        it('does not allowlist anything for a bare `*` entry', () => {
            const engine = createMv3Engine(['*']);

            expect(engine.matchFrame('https://a.com/')).toBeNull();
            expect(engine.matchFrame('https://www.a.com/')).toBeNull();
        });

        it('does not allowlist anything for a bare `**` entry', () => {
            const engine = createMv3Engine(['**']);

            expect(engine.matchFrame('https://a.com/')).toBeNull();
        });

        it('does not allowlist anything for a padded bare `*` entry', () => {
            const engine = createMv3Engine([' * ']);

            expect(engine.matchFrame('https://a.com/')).toBeNull();
        });

        it('keeps the documented full wildcard `*.*`', () => {
            const engine = createMv3Engine(['*.*']);

            expect(engine.matchFrame('https://a.com/')).not.toBeNull();
            expect(engine.matchFrame('https://localhost/')).not.toBeNull();
        });
    });

    describe('getAllowlistRules matching in MV3 for a wildcard entry', () => {
        const matchingCases = [
            // A wildcard entry covers the hosts it describes, and its `*.` twin adds their subdomains.
            { entries: ['example.*'], url: 'https://example.com/' },
            { entries: ['example.*'], url: 'https://sub.example.org/' },
            { entries: ['*example.com'], url: 'https://myexample.com/' },
        ];

        it.each(matchingCases)('matches $url for $entries', ({ entries, url }) => {
            expect(createMv3Engine(entries).matchFrame(url)).not.toBeNull();
        });

        const notMatchingCases = [
            // The `*.` twin stays within the host, so it cannot reach the userinfo or the path.
            { entries: ['example.*'], url: 'https://example.com@evil.org/' },
            { entries: ['example.*'], url: 'https://evil.org//example.com/' },
            { entries: ['*example.com'], url: 'https://example.com@evil.org/' },
            { entries: ['*example.com'], url: 'https://evil.org//example.com/' },
            { entries: ['*example.com'], url: 'https://evil.org/?url=//example.com/' },
        ];

        it.each(notMatchingCases)('does not match $url for $entries', ({ entries, url }) => {
            expect(createMv3Engine(entries).matchFrame(url)).toBeNull();
        });
    });
});
