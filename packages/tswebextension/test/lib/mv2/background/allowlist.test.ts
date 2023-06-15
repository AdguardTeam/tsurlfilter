import { StringRuleList, NetworkRule } from '@adguard/tsurlfilter';
import { Allowlist } from '@lib/mv2/background/allowlist';
import { ALLOWLIST_FILTER_ID } from '@lib/common/constants';
import { getConfigurationMv2Fixture } from './fixtures/configuration';

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

        it.each(cases)('should parse $input to $expected', ({ input, expected }) => {
            const config = getConfigurationMv2Fixture();

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
                expected: new StringRuleList(
                    ALLOWLIST_FILTER_ID,
                    '@@///(www\\.)?example.com/$document,important',
                ),
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
        it('should return allowlist rule, when domain is specified', () => {
            const domain = 'example.com';

            expect(Allowlist.createAllowlistRule(domain)).toStrictEqual(
                new NetworkRule(
                    String.raw`@@///(www\.)?${domain}/$document,important`,
                    ALLOWLIST_FILTER_ID,
                ),
            );
        });

        it('should return null, when domain is empty', () => {
            expect(Allowlist.createAllowlistRule('')).toBeNull();
        });
    });
});
