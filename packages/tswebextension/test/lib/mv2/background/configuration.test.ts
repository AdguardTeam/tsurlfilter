import { describe, expect, it } from 'vitest';

import { type ConfigurationMV2, configurationMV2Validator } from '../../../../src/lib';
import { CanvasPolicyBrowser } from '../../../../src/lib/common/canvas-protection/constants';
import { LF } from '../../../../src/lib/common/constants';
import { createProtectAllPolicy } from '../../common/canvas-protection/fixtures/prepared-policies';

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
        }).toThrow(JSON.stringify([
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
    it('accepts optional canvas opt-in and prepared policy without changing legacy defaults', () => {
        const policy = createProtectAllPolicy(CanvasPolicyBrowser.FirefoxMv2, 'policy-a');
        const input = {
            ...validConfiguration,
            canvasProtectionPolicy: policy,
            settings: {
                ...validConfiguration.settings,
                stealth: { ...validConfiguration.settings.stealth, protectCanvas: true },
            },
        };
        expect(configurationMV2Validator.parse(input)).toEqual(input);
        expect(configurationMV2Validator.parse(validConfiguration).settings.stealth)
            .not.toHaveProperty('protectCanvas');
        expect(() => configurationMV2Validator.parse({
            ...input, canvasProtectionPolicy: { ...policy, schemaVersion: 2 },
        }))
            .toThrow();
        expect(() => configurationMV2Validator.parse({
            ...input, settings: { ...input.settings, stealth: { ...input.settings.stealth, protectCanvas: 'true' } },
        })).toThrow();
    });
});
