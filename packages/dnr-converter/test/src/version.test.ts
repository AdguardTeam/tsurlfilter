import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { DNR_CONVERTER_VERSION } from '../../src/version';

describe('Version', () => {
    it('should match package.json version', () => {
        const packageJsonPath = resolve(__dirname, '../../package.json');
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        expect(DNR_CONVERTER_VERSION).toBe(packageJson.version);
    });
});
