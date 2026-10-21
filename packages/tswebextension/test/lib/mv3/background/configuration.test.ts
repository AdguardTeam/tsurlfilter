import { describe, expect, it } from 'vitest';

import { preregisteredScriptsConfigValidator } from '../../../../src/lib/mv3/background/configuration';

describe('preregisteredScriptsConfigValidator', () => {
    it('normalizes plain hostnames', () => {
        expect(preregisteredScriptsConfigValidator.parse({
            domains: [' YouTube.com '],
            path: 'scripts',
        })).toEqual({
            domains: ['youtube.com'],
            path: 'scripts',
        });
    });

    it('rejects a wildcard domain', () => {
        expect(() => preregisteredScriptsConfigValidator.parse({
            domains: ['*'],
            path: 'scripts',
        })).toThrow();
    });

    it('rejects a scheme and a path', () => {
        expect(() => preregisteredScriptsConfigValidator.parse({
            domains: ['https://youtube.com'],
            path: 'scripts',
        })).toThrow();
    });

    it('rejects a port and a malformed hostname', () => {
        expect(() => preregisteredScriptsConfigValidator.parse({
            domains: ['youtube.com:8080'],
            path: 'scripts',
        })).toThrow();
        expect(() => preregisteredScriptsConfigValidator.parse({
            domains: ['youtube..com'],
            path: 'scripts',
        })).toThrow();
    });
});
