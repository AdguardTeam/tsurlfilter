import {
    describe,
    expect,
    beforeEach,
    it,
} from 'vitest';

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
