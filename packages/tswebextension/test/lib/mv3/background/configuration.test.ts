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

    it('rejects userinfo, query strings and fragments instead of silently stripping them', () => {
        // `URL` would turn each of these into `youtube.com`, enabling
        // preregistration for a host the caller did not write.
        for (const domain of ['u@youtube.com', 'youtube.com?x=1', 'youtube.com#frag']) {
            expect(() => preregisteredScriptsConfigValidator.parse({
                domains: [domain],
                path: 'scripts',
            })).toThrow();
        }
    });

    it('rejects a value that normalizes to an empty hostname', () => {
        expect(() => preregisteredScriptsConfigValidator.parse({
            domains: ['...'],
            path: 'scripts',
        })).toThrow();
    });

    it('rejects an empty artifacts path', () => {
        // An empty path reads the extension's own manifest.json and fails
        // with a confusing schema-version error at runtime.
        expect(() => preregisteredScriptsConfigValidator.parse({
            domains: ['youtube.com'],
            path: '',
        })).toThrow();
    });
});
