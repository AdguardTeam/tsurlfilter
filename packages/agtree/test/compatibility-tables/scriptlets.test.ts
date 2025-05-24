import { describe, it, expect } from 'vitest';

import { scriptletsCompatibilityTable } from '../../src/compatibility-tables/scriptlets.js';
import { GenericPlatform, SpecificPlatform } from '../../src/compatibility-tables/platforms.js';

const baseAbortCurrentInlineScriptData = {
    name: 'abort-current-inline-script',
    // ...
};

describe('Scriptlets Compatibility Table', () => {
    it('scriptletsCompatibilityTable.existsAny', () => {
        expect(scriptletsCompatibilityTable.existsAny('abort-current-inline-script')).toBeTruthy();
        expect(scriptletsCompatibilityTable.existsAny('abort-on-property-read')).toBeTruthy();

        expect(scriptletsCompatibilityTable.existsAny('nonexistent')).toBeFalsy();
    });

    it('scriptletsCompatibilityTable.exists', () => {
        expect(
            scriptletsCompatibilityTable.exists('abort-current-inline-script', SpecificPlatform.AdgExtChrome),
        ).toBeTruthy();
        expect(
            scriptletsCompatibilityTable.exists('nonexistent', SpecificPlatform.AbpExtChrome),
        ).toBeFalsy();

        expect(
            scriptletsCompatibilityTable.exists('abort-current-inline-script', GenericPlatform.AdgExtAny),
        ).toBeTruthy();
        expect(
            scriptletsCompatibilityTable.exists('nonexistent', GenericPlatform.AbpExtAny),
        ).toBeFalsy();
    });

    it('scriptletsCompatibilityTable.getSingle', () => {
        expect(
            scriptletsCompatibilityTable.getSingle('abort-current-inline-script', SpecificPlatform.AdgExtChrome),
        ).toMatchObject(baseAbortCurrentInlineScriptData);

        expect(scriptletsCompatibilityTable.getSingle('nonexistent', SpecificPlatform.AbpExtChrome)).toBeNull();
    });

    it('scriptletsCompatibilityTable.getMultiple', () => {
        expect(
            scriptletsCompatibilityTable.getMultiple('abort-current-inline-script', GenericPlatform.AdgExtAny),
        ).toMatchObject({
            [SpecificPlatform.AdgExtChrome]: baseAbortCurrentInlineScriptData,
            [SpecificPlatform.AdgExtOpera]: baseAbortCurrentInlineScriptData,
            [SpecificPlatform.AdgExtEdge]: baseAbortCurrentInlineScriptData,
            [SpecificPlatform.AdgExtFirefox]: baseAbortCurrentInlineScriptData,
        });

        expect(scriptletsCompatibilityTable.getMultiple('nonexistent', GenericPlatform.AdgExtAny)).toBeNull();
    });

    // TODO: Add more tests
});
