import { NetworkRule, StringRuleList } from '@adguard/tsurlfilter';
import { AllowlistApi } from '@lib/mv2/background/allowlist';
import { engineApi } from '@lib/mv2/background/engine-api';
import { getConfigurationMv2Fixture } from './fixtures/configuration';

describe('Allowlist Api', () => {
    let allowlistApi: AllowlistApi;

    beforeEach(() => {
        allowlistApi = new AllowlistApi();
    });

    describe('Parses hostnames from allowlist', () => {
        const cases = [
            { input: ['example.com'], expected: ['example.com'] },
            { input: ['www.example.com'], expected: ['example.com'] },
            { input: ['sub.example.com'], expected: ['sub.example.com'] },
            { input: ['www.sub.example.com'], expected: ['sub.example.com'] },
            { input: ['www.sub.sub.example.com'], expected: ['sub.sub.example.com'] },
        ];

        it.each(cases)('parses $input to $expected', ({ input, expected }) => {
            const config = getConfigurationMv2Fixture();

            config.allowlist = input;

            allowlistApi.configure(config);

            expect(allowlistApi.domains).toStrictEqual(expected);
        });
    });

    describe('Gets allowlist rules', () => {
        const cases = [
            {
                title: 'returns filter list, when API is enabled and  not inverted',
                enabled: true,
                inverted: false,
                expected: new StringRuleList(
                    AllowlistApi.allowlistFilterId,
                    '@@///(www\\.)?example.com/$document,important',
                ),
            },
            {
                title: 'returns null, when API is enabled and inverted',
                enabled: true,
                inverted: true,
                expected: null,
            },
            {
                title: 'returns null, when API is disabled and not inverted',
                enabled: false,
                inverted: false,
                expected: null,
            },
            {
                title: 'returns null, when allowlist is disabled and inverted',
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

            allowlistApi.configure(config);

            expect(allowlistApi.getAllowlistRules()).toStrictEqual(expected);
        });
    });

    describe('Matches frame rule', () => {
        const mockRule = new NetworkRule('test', 0);

        let matchFrameSpy: jest.SpyInstance<NetworkRule | null, [frameUrl: string]>;

        beforeAll(() => {
            matchFrameSpy = jest.spyOn(engineApi, 'matchFrame').mockReturnValue(mockRule);
        });

        afterAll(() => {
            matchFrameSpy.mockRestore();
        });

        const cases = [
            {
                title: 'call engine.matchFrame, when API is not inverted',
                inverted: false,
                url: 'https://example.com',
                allowlist: ['example.com'],
                expected: mockRule,
            },
            {
                title: 'call engine.matchFrame, when domain is allowlisted and API is inverted',
                inverted: true,
                url: 'https://example.com',
                allowlist: ['example.com'],
                expected: mockRule,
            },
            {
                title: 'returns custom rule, when domain is not allowlisted and API is inverted',
                inverted: true,
                url: 'https://example.com',
                allowlist: [],
                expected: new NetworkRule(
                    '@@///(www\\.)?example.com/$document,important',
                    AllowlistApi.allowlistFilterId,
                ),
            },
        ];

        it.each(cases)('$title', ({
            inverted,
            url,
            allowlist,
            expected,
        }) => {
            const config = getConfigurationMv2Fixture();

            config.allowlist = allowlist;
            config.settings.allowlistEnabled = true;
            config.settings.allowlistInverted = inverted;

            allowlistApi.configure(config);

            allowlistApi.matchFrame(url);

            expect(allowlistApi.matchFrame(url)).toStrictEqual(expected);
        });
    });
});
