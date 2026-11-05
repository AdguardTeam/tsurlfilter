import {
    beforeEach,
    describe,
    expect,
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
            // A `*` outside the `*.` mask has no DNR equivalent, so it is skipped instead of
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
            // In the inverted mode the full wildcard excludes nothing, so it is skipped.
            {
                input: ['*.*', 'example.com'],
                inverted: true,
                expected: '@@$document,important,to=~example.com',
            },
            {
                input: ['*example.com', 'example.org'],
                inverted: true,
                expected: '@@$document,important,to=~example.org',
            },
            // A list without expressible entries means "block nothing" in the inverted mode, the
            // same answer `matchFrameInverted()` gives, so it must not end up as an empty rule.
            {
                input: ['*.*'],
                inverted: true,
                expected: '@@$document,important',
            },
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
            config.settings.allowlistInverted = inverted;

            allowlist.configure(config);
            const combinedRule = allowlist.combineAllowListRulesForDNR();

            expect(combinedRule).toStrictEqual(expected);
        });
    });
});
