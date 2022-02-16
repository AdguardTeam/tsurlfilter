import { ZodError } from 'zod';
import { configurationValidator } from '@lib/common';

describe('configuration validator', () => {
    const validConfiguration = {
        filters: [
            { filterId: 1, content: '' },
            { filterId: 2, content: '' },
        ],
        allowlist: ['example.com'],
        userrules: ['||example.org^', 'example.com##h1'],
        verbose: false,
        settings: {
            collectStats: true,
            allowlistInverted: false,
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
        expect(configurationValidator.parse(validConfiguration)).toEqual(validConfiguration);
    });

    it('throws error on required field missing', () => {
        expect(() => {
            configurationValidator.parse({
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

    it('throws error on nested field missmatch', () => {
        const configuration = {
            ...validConfiguration,
            filters: [
                { filterId: 1, content: false },
                { filterId: 2, content: '' },
            ],
        };

        expect(() => {
            configurationValidator.parse(configuration);
        }).toThrow(new ZodError([{
            code: 'invalid_type',
            expected: 'string',
            received: 'boolean',
            path: [
                'filters',
                0,
                'content',
            ],
            message: 'Expected string, received boolean',
        }]));
    });

    it('throws error on unrecognized key detection', () => {
        const configuration = {
            ...validConfiguration,
            beep: 'boop',
        };

        expect(() => {
            configurationValidator.parse(configuration);
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
