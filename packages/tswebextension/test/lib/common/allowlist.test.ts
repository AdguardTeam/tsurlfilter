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
const DOMAIN_RULE_START = String.raw`@@/^(?:https?|wss?)://(?:[^/\\?#]*@)?(www\.)?`;

/**
 * End of the rule generated for an entry without the `*.` prefix: the host end — an optional root
 * label dot, an optional port, the path, the query, the fragment or the end of the URL — and the
 * modifiers.
 */
const DOMAIN_RULE_END = String.raw`(?:\.)?(?::\d*)?(?:[/\\?#]|$)/$document,important`;

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
                    expected: `${DOMAIN_RULE_START}example\\..*${DOMAIN_RULE_END}`,
                },
                {
                    domain: 'example.*.com',
                    expected: `${DOMAIN_RULE_START}example\\..*\\.com${DOMAIN_RULE_END}`,
                },
                {
                    domain: '*.example.com',
                    expected: String.raw`@@||example.com^$document,important`,
                },
                {
                    domain: '*.sub.example.*',
                    expected: String.raw`@@||sub.example.*^$document,important`,
                },
                {
                    domain: '*example.com',
                    expected: `${DOMAIN_RULE_START}.*example\\.com${DOMAIN_RULE_END}`,
                },
                {
                    domain: 'example*.com',
                    expected: `${DOMAIN_RULE_START}example.*\\.com${DOMAIN_RULE_END}`,
                },
                {
                    domain: 'exam*ple.com',
                    expected: `${DOMAIN_RULE_START}exam.*ple\\.com${DOMAIN_RULE_END}`,
                },
                {
                    domain: '*.example*.com',
                    expected: String.raw`@@||example*.com^$document,important`,
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
});
