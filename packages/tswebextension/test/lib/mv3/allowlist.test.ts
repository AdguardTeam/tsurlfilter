import { AllowlistApi } from '@lib/mv3/background/allowlist-api';
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
                expected: '@@$document,to=example.com|example.org',
            },
            {
                input: ['example.com', 'example.org'],
                inverted: true,
                expected: '@@$document,to=~example.com|~example.org',
            },
            {
                input: [],
                inverted: false,
                expected: '',
            },
        ];

        it.each(cases)('should combine $input rules to $expected for MV2', ({ input, inverted, expected }) => {
            const config = getConfigurationMv3Fixture();

            config.allowlist = input;
            config.settings.allowlistInverted = inverted;

            allowlist.configure(config);
            const combinedRule = allowlist.combineAllowListRulesForDNR();

            expect(combinedRule).toStrictEqual(expected);
        });
    });
});