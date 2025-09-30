import { describe, expect, it } from 'vitest';

import { type ConfigurationMV2, configurationMV2Validator, FilterListPreprocessor } from '../../../../src/lib';
import { LF } from '../../../../src/lib/common/constants';

describe('configuration validator', () => {
    const validConfiguration: ConfigurationMV2 = {
        filters: [
            { filterId: 1, content: FilterListPreprocessor.preprocess('').filterList, trusted: true },
            { filterId: 2, content: FilterListPreprocessor.preprocess('').filterList, trusted: true },
        ],
        allowlist: ['example.com'],
        trustedDomains: [],
        userrules: {
            content: FilterListPreprocessor.preprocess(
                ['||example.org^', 'example.com##h1'].join(LF),
            ).filterList,
        },
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
        }).toThrow(JSON.stringify([{
            code: 'invalid_type',
            expected: 'object',
            received: 'undefined',
            path: [
                'settings',
            ],
            message: 'Required',
        }], null, 2));
    });

    it('throws error on nested field missmatch', () => {
        const configuration = {
            ...validConfiguration,
            filters: [
                { filterId: 1, content: false, trusted: true },
                { filterId: 2, content: '', trusted: true },
            ],
        };

        expect(() => {
            configurationMV2Validator.parse(configuration);
        }).toThrow(JSON.stringify([
            {
                code: 'invalid_type',
                expected: 'array',
                received: 'boolean',
                path: [
                    'filters',
                    0,
                    'content',
                ],
                message: 'Expected array, received boolean',
            },
            {
                code: 'invalid_type',
                expected: 'array',
                received: 'string',
                path: [
                    'filters',
                    1,
                    'content',
                ],
                message: 'Expected array, received string',
            },
        ], null, 2));
    });

    it('throws error on unrecognized key detection', () => {
        const configuration = {
            ...validConfiguration,
            beep: 'boop',
        };

        expect(() => {
            configurationMV2Validator.parse(configuration);
        }).toThrow(JSON.stringify([{
            code: 'unrecognized_keys',
            keys: [
                'beep',
            ],
            path: [],
            message: "Unrecognized key(s) in object: 'beep'",
        }], null, 2));
    });
});
