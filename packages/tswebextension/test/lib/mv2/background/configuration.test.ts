import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { type ConfigurationMV2, configurationMV2Validator } from '../../../../src/lib';
import { LF } from '../../../../src/lib/common/constants';

describe('configuration validator', () => {
    const validConfiguration: ConfigurationMV2 = {
        filters: [
            { filterId: 1, content: '', trusted: true },
            { filterId: 2, content: '', trusted: true },
        ],
        allowlist: ['example.com'],
        trustedDomains: [],
        userrules: { content: ['||example.org^', 'example.com##h1'].join(LF) },
        verbose: false,
        settings: {
            filteringEnabled: true,
            stealthModeEnabled: true,
            collectStats: true,
            debugScriptlets: false,
            allowlistInverted: false,
            allowlistEnabled: false,
            documentBlockingPageUrl: 'https://example.org',
            assistantUrl: '/assistant-inject.js',
            stealth: {
                blockChromeClientData: true,
                hideReferrer: true,
                hideSearchQueries: true,
                sendDoNotTrack: true,
                blockWebRTC: true,
                selfDestructThirdPartyCookies: true,
                selfDestructThirdPartyCookiesTime: 3600,
                selfDestructFirstPartyCookies: true,
                selfDestructFirstPartyCookiesTime: 3600,
            },
        },
    };

    it('passes valid configuration', () => {
        expect(configurationMV2Validator.parse(validConfiguration)).toEqual(validConfiguration);
    });

    it('throws error on required field missing', () => {
        expect(() => {
            configurationMV2Validator.parse({
                ...validConfiguration,
                settings: undefined,
            });
        }).toThrow(new ZodError([{
            code: 'invalid_type',
            expected: 'object',
            received: 'undefined',
            path: [
                'settings',
            ],
            message: 'Required',
        }]));
    });

    it('tests that content is a string', () => {
        const configuration = {
            ...validConfiguration,
            filters: [
                { filterId: 1, content: false, trusted: true },
                { filterId: 2, content: [], trusted: true },
            ],
        };

        expect(() => {
            configurationMV2Validator.parse(configuration);
        }).toThrow(new ZodError([
            {
                code: 'invalid_type',
                expected: 'string',
                received: 'boolean',
                path: [
                    'filters',
                    0,
                    'content',
                ],
                message: 'Expected string, received boolean',
            },
            {
                code: 'invalid_type',
                expected: 'string',
                received: 'array',
                path: [
                    'filters',
                    1,
                    'content',
                ],
                message: 'Expected string, received array',
            },
        ]));
    });

    it('throws error on unrecognized key detection', () => {
        const configuration = {
            ...validConfiguration,
            beep: 'boop',
        };

        expect(() => {
            configurationMV2Validator.parse(configuration);
        }).toThrow(new ZodError([{
            code: 'unrecognized_keys',
            keys: [
                'beep',
            ],
            path: [],
            message: "Unrecognized key(s) in object: 'beep'",
        }]));
    });
});
