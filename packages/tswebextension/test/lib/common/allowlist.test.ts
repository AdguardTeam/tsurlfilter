import {
    describe,
    expect,
    beforeEach,
    it,
} from 'vitest';

import { createNetworkRule } from '../../helpers/rule-creator';
import { getConfigurationMv2Fixture } from '../mv2/background/fixtures/configuration';
import { getConfigurationMv3Fixture } from '../mv3/fixtures/configuration';
import { Allowlist } from '../../../src/lib/mv2/background/allowlist';
import { ALLOWLIST_FILTER_ID } from '../../../src/lib/common/constants';

describe('Allowlist Api', () => {
    let allowlist: Allowlist;

    beforeEach(() => {
        allowlist = new Allowlist();
    });

    describe('configure method', () => {
        const cases = [
            { input: ['example.com'], expected: ['example.com'] },
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
                expected: '@@///(www\\.)?example\\.com/$document,important',
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
                    expected: String.raw`@@///(www\.)?example\.com/$document,important`,
                },
                {
                    domain: 'sub.example.com',
                    expected: String.raw`@@///(www\.)?sub\.example\.com/$document,important`,
                },
                {
                    domain: 'example.*',
                    expected: String.raw`@@///(www\.)?example\..*/$document,important`,
                },
                {
                    domain: 'example.*.com',
                    expected: String.raw`@@///(www\.)?example\..*\.com/$document,important`,
                },
                {
                    domain: '*.example.com',
                    expected: String.raw`@@||example.com$document,important`,
                },
                {
                    domain: '*.sub.example.*',
                    expected: String.raw`@@||sub.example.*$document,important`,
                },
                {
                    domain: '*example.com',
                    expected: String.raw`@@///(www\.)?.*example\.com/$document,important`,
                },
                {
                    domain: 'example*.com',
                    expected: String.raw`@@///(www\.)?example.*\.com/$document,important`,
                },
                {
                    domain: 'exam*ple.com',
                    expected: String.raw`@@///(www\.)?exam.*ple\.com/$document,important`,
                },
                {
                    domain: '*.example*.com',
                    expected: String.raw`@@||example*.com$document,important`,
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
});
