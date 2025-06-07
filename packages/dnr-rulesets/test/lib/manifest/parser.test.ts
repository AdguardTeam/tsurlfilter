import { describe, expect, it } from 'vitest';

import { type Manifest, ManifestParser } from '../../../src/lib/manifest/parser';

describe('ManifestParser', () => {
    const parser = new ManifestParser();

    it('should parse a valid manifest', () => {
        const manifest: Manifest = {
            manifest_version: 3,
            background: {
                service_worker: 'pages/background.js',
            },
            declarative_net_request: {
                rule_resources: [{
                    id: '1',
                    enabled: true,
                    path: 'ruleset.json',
                }],
            },
        };
        const parsed = parser.parse(JSON.stringify(manifest));

        expect(manifest).toEqual(parsed);
    });

    it('should throw an error if manifest is invalid', () => {
        const manifest = {
            declarative_net_request: 'invalid',
        };

        expect(() => parser.parse(JSON.stringify(manifest))).toThrow();
    });
});
