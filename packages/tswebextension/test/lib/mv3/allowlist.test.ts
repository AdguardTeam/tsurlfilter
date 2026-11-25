import {
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';

import { type DeclarativeRule, Filter, FilterConverter } from '@adguard/dnr-converter';

import { ALLOWLIST_FILTER_ID } from '../../../src/lib/common/constants';
import { AllowlistApi } from '../../../src/lib/mv3/background/allowlist-api';

import { getConfigurationMv3Fixture } from './fixtures/configuration';

describe('Allowlist Api', () => {
    let allowlist: AllowlistApi;

    beforeEach(() => {
        allowlist = new AllowlistApi();
    });

    describe('combineAllowListRulesForDNR method', () => {
        const cases = [
            {
                input: ['example.com', 'example.org'],
                inverted: false,
                expected: '@@$document,important,to=example.com|example.org',
            },
            {
                input: ['*.pages.dev'],
                inverted: false,
                expected: '@@$document,important,to=pages.dev',
            },
            {
                input: ['pages.dev'],
                inverted: false,
                expected: '@@$document,important,to=pages.dev',
            },
            {
                input: ['*.pages.dev', 'pages.dev'],
                inverted: false,
                expected: '@@$document,important,to=pages.dev',
            },
            {
                input: ['*.allowlist.pages.dev', 'pages.dev'],
                inverted: false,
                expected: '@@$document,important,to=allowlist.pages.dev|pages.dev',
            },
            {
                input: ['*.allowlist.pages.dev', '*.pages.dev'],
                inverted: false,
                expected: '@@$document,important,to=allowlist.pages.dev|pages.dev',
            },
            {
                input: ['*.allowlist.pages.dev', '*.dev'],
                inverted: false,
                expected: '@@$document,important,to=allowlist.pages.dev|dev',
            },
            {
                input: ['example.com', 'example.org'],
                inverted: true,
                expected: '@@$document,important,to=~example.com|~example.org',
            },
            {
                input: [],
                inverted: false,
                expected: '',
            },
            {
                input: [],
                inverted: true,
                expected: '@@$document,important',
            },
            // A wildcard inside a label has no DNR equivalent, so it is skipped instead of
            // dropping the domain condition of the whole rule.
            {
                input: ['*example.com'],
                inverted: false,
                expected: '',
            },
            {
                input: ['example*.com'],
                inverted: false,
                expected: '',
            },
            {
                input: ['*example.com', 'example.org'],
                inverted: false,
                expected: '@@$document,important,to=example.org',
            },
            // A wildcard TLD is expressible: the converter enumerates the known top-level domains,
            // and the `*.` mask is mapped to its upper domain first.
            {
                input: ['example.*'],
                inverted: false,
                expected: '@@$document,important,to=example.*',
            },
            {
                input: ['*.example.*'],
                inverted: false,
                expected: '@@$document,important,to=example.*',
            },
            {
                input: ['www.*'],
                inverted: false,
                expected: '@@$document,important,to=www.*',
            },
            {
                input: ['*.example.*', 'example.org'],
                inverted: false,
                expected: '@@$document,important,to=example.*|example.org',
            },
            // A wildcard inside a label has no DNR equivalent, so it is skipped.
            {
                input: ['example.*.com', 'example.org'],
                inverted: false,
                expected: '@@$document,important,to=example.org',
            },
            // The full wildcard covers every document, which is a rule without `$to`.
            {
                input: ['*.*'],
                inverted: false,
                expected: '@@$document,important',
            },
            {
                input: ['*.*', 'example.com'],
                inverted: false,
                expected: '@@$document,important',
            },
            // In the inverted mode the full wildcard excludes nothing, so no rule can select the
            // hosts it should keep filtered.
            {
                input: ['*.*', 'example.com'],
                inverted: true,
                expected: '',
            },
            {
                input: ['*example.com', 'example.org'],
                inverted: true,
                expected: '@@$document,important,to=~example.org',
            },
            {
                input: ['*.*'],
                inverted: true,
                expected: '',
            },
            // A list without expressible entries means "block nothing" in the inverted mode, the
            // same answer `matchFrameInverted()` gives, so it must not end up as an empty rule.
            {
                input: ['*example.com'],
                inverted: true,
                expected: '@@$document,important',
            },
            {
                input: ['*.example.*'],
                inverted: true,
                expected: '@@$document,important,to=~example.*',
            },
        ];

        it.each(cases)('should combine $input rules to $expected for MV2', ({ input, inverted, expected }) => {
            const config = getConfigurationMv3Fixture();

            config.allowlist = input;
            config.settings.allowlistEnabled = true;
            config.settings.allowlistInverted = inverted;

            allowlist.configure(config);
            const combinedRule = allowlist.combineAllowListRulesForDNR();

            expect(combinedRule).toStrictEqual(expected);
        });

        it('should return no rule when the allowlist is disabled', () => {
            for (const inverted of [false, true]) {
                const config = getConfigurationMv3Fixture();

                config.allowlist = [];
                config.settings.allowlistEnabled = false;
                config.settings.allowlistInverted = inverted;

                allowlist.configure(config);

                // A disabled allowlist must not add a rule: in the inverted mode a rule without
                // `$to` would let DNR allow every main frame.
                expect(allowlist.combineAllowListRulesForDNR()).toStrictEqual('');
            }
        });
    });

    describe('combined rule conversion for DNR', () => {
        /**
         * Converts the rule combined for the given entries, the way the application passes it to
         * the converter.
         *
         * @param entries Allowlist entries.
         * @param inverted Whether the entries select protected domains.
         *
         * @returns The installed allowlist rule, or undefined if there is none.
         */
        const convertCombinedRule = async (
            entries: string[],
            inverted = false,
        ): Promise<DeclarativeRule | undefined> => {
            const config = getConfigurationMv3Fixture();

            config.allowlist = entries;
            config.settings.allowlistEnabled = true;
            config.settings.allowlistInverted = inverted;

            const allowlistApi = new AllowlistApi();
            allowlistApi.configure(config);

            const combinedRule = allowlistApi.combineAllowListRulesForDNR();

            if (!combinedRule) {
                return undefined;
            }

            const [{ ruleset }] = await new FilterConverter()
                .convert([new Filter(ALLOWLIST_FILTER_ID, combinedRule)]);

            return ruleset.getDeclarativeRules()[0];
        };

        it('installs no rule for an entry with a wildcard inside a label', async () => {
            expect(await convertCombinedRule(['*example.com'])).toBeUndefined();
            expect(await convertCombinedRule(['example*.com'])).toBeUndefined();
        });

        it('enumerates the top-level domains for a wildcard TLD entry', async () => {
            const rule = await convertCombinedRule(['example.*']);

            expect(rule?.condition.requestDomains).toContain('example.com');
            expect(rule?.condition.requestDomains).toContain('example.org');
        });

        it('keeps a plain entry next to a wildcard TLD entry', async () => {
            const rule = await convertCombinedRule(['*.example.*', 'other.com']);

            expect(rule?.condition.requestDomains).toContain('example.com');
            expect(rule?.condition.requestDomains).toContain('other.com');
        });

        it('allows every document for the full wildcard', async () => {
            const rule = await convertCombinedRule(['*.*', 'example.com']);

            expect(rule).toBeDefined();
            expect(rule?.condition.requestDomains).toBeUndefined();
        });

        it('allows every document in the inverted mode when nothing is expressible', async () => {
            const rule = await convertCombinedRule(['*example.com'], true);

            expect(rule).toBeDefined();
            expect(rule?.condition.requestDomains).toBeUndefined();
            expect(rule?.condition.excludedRequestDomains).toBeUndefined();
        });

        it('excludes the entries in the inverted mode', async () => {
            const rule = await convertCombinedRule(['example.org', 'example.com'], true);

            expect(rule?.condition.excludedRequestDomains).toContain('example.com');
            expect(rule?.condition.excludedRequestDomains).toContain('example.org');
        });

        it('installs no rule for the full wildcard in the inverted mode', async () => {
            // No rule keeps network filtering on everywhere, as the page decision keeps it on.
            expect(await convertCombinedRule(['*.*'], true)).toBeUndefined();
            expect(await convertCombinedRule(['*.*', 'example.com'], true)).toBeUndefined();
        });

        it.each([
            'example.com', '*.example.com', 'example.*', '*.example.*', 'www.*',
            '*example.com', 'example.ly', '*.*', '*.ex*ple.com',
        ])('lists the hosts the inverted DNR rule filters for %s', async (entry) => {
            const hosts = [
                'example.com', 'www.example.com', 'b.example.com', 'a.b.example.com',
                'example.ly', 'www.example.co.uk', 'example.community', 'myexample.com',
                'www.a.com', 'a.www.com', 'other.org',
            ];

            /**
             * Whether the converted rule keeps network filtering on for the host. Without a rule DNR
             * filters every host; a rule without exclusions allows every host.
             *
             * @param rule Installed allowlist rule.
             * @param host Hostname to check.
             *
             * @returns True if the network layer filters the host.
             */
            const dnrFilters = (rule: DeclarativeRule | undefined, host: string): boolean => {
                if (!rule) {
                    return true;
                }

                const excluded = rule.condition.excludedRequestDomains;

                return excluded?.some((domain) => host === domain || host.endsWith(`.${domain}`)) ?? false;
            };

            const rule = await convertCombinedRule([entry], true);
            const config = getConfigurationMv3Fixture();
            config.allowlist = [entry];
            config.settings.allowlistEnabled = true;
            config.settings.allowlistInverted = true;

            const allowlistApi = new AllowlistApi();
            allowlistApi.configure(config);

            for (const host of hosts) {
                expect(allowlistApi.isDomainListed(host), `page decision for ${entry} at ${host}`)
                    .toBe(dnrFilters(rule, host));
            }
        });
    });
});
