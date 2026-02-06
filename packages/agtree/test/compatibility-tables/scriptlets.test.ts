import { describe, it, expect } from 'vitest';

import { scriptletsCompatibilityTable } from '../../src/compatibility-tables/scriptlets';
import { GenericPlatform, SpecificPlatform } from '../../src/compatibility-tables/platforms';

const baseAbortCurrentInlineScriptData = {
    name: 'abort-current-inline-script',
    // ...
};

const basePreventInnerHTMLAdgData = {
    name: 'prevent-innerHTML',
    aliases: [
        'prevent-innerHTML.js',
        'ubo-prevent-innerHTML.js',
        'ubo-prevent-innerHTML',
    ],
};

const basePreventInnerHTMLUboData = {
    name: 'prevent-innerHTML.js',
    aliases: [
        'prevent-innerHTML',
    ],
};

describe('Scriptlets Compatibility Table', () => {
    it('scriptletsCompatibilityTable.existsAny', () => {
        expect(scriptletsCompatibilityTable.existsAny('abort-current-inline-script')).toBeTruthy();
        expect(scriptletsCompatibilityTable.existsAny('abort-on-property-read')).toBeTruthy();

        // prevent-innerHTML scriptlet
        expect(scriptletsCompatibilityTable.existsAny('prevent-innerHTML')).toBeTruthy();
        expect(scriptletsCompatibilityTable.existsAny('prevent-innerHTML.js')).toBeTruthy();

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

        // prevent-innerHTML - AdGuard platforms
        expect(
            scriptletsCompatibilityTable.exists('prevent-innerHTML', GenericPlatform.AdgExtAny),
        ).toBeTruthy();
        expect(
            scriptletsCompatibilityTable.exists('prevent-innerHTML', GenericPlatform.AdgOsAny),
        ).toBeTruthy();

        // prevent-innerHTML - uBlock Origin platforms
        expect(
            scriptletsCompatibilityTable.exists('prevent-innerHTML.js', GenericPlatform.UboExtAny),
        ).toBeTruthy();

        // prevent-innerHTML - should not exist on ABP
        expect(
            scriptletsCompatibilityTable.exists('prevent-innerHTML', SpecificPlatform.AbpExtChrome),
        ).toBeFalsy();
    });

    it('scriptletsCompatibilityTable.getSingle', () => {
        expect(
            scriptletsCompatibilityTable.getSingle('abort-current-inline-script', SpecificPlatform.AdgExtChrome),
        ).toMatchObject(baseAbortCurrentInlineScriptData);

        expect(scriptletsCompatibilityTable.getSingle('nonexistent', SpecificPlatform.AbpExtChrome)).toBeNull();

        // prevent-innerHTML - AdGuard
        expect(
            scriptletsCompatibilityTable.getSingle('prevent-innerHTML', SpecificPlatform.AdgExtChrome),
        ).toMatchObject(basePreventInnerHTMLAdgData);

        // prevent-innerHTML - uBlock Origin
        expect(
            scriptletsCompatibilityTable.getSingle('prevent-innerHTML.js', SpecificPlatform.UboExtChrome),
        ).toMatchObject(basePreventInnerHTMLUboData);

        // prevent-innerHTML - should return null for ABP
        expect(
            scriptletsCompatibilityTable.getSingle('prevent-innerHTML', SpecificPlatform.AbpExtChrome),
        ).toBeNull();
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

        // prevent-innerHTML - AdGuard extensions
        expect(
            scriptletsCompatibilityTable.getMultiple('prevent-innerHTML', GenericPlatform.AdgExtAny),
        ).toMatchObject({
            [SpecificPlatform.AdgExtChrome]: basePreventInnerHTMLAdgData,
            [SpecificPlatform.AdgExtOpera]: basePreventInnerHTMLAdgData,
            [SpecificPlatform.AdgExtEdge]: basePreventInnerHTMLAdgData,
            [SpecificPlatform.AdgExtFirefox]: basePreventInnerHTMLAdgData,
        });

        // prevent-innerHTML - uBlock Origin extensions
        expect(
            scriptletsCompatibilityTable.getMultiple('prevent-innerHTML.js', GenericPlatform.UboExtAny),
        ).toMatchObject({
            [SpecificPlatform.UboExtChrome]: basePreventInnerHTMLUboData,
            [SpecificPlatform.UboExtOpera]: basePreventInnerHTMLUboData,
            [SpecificPlatform.UboExtEdge]: basePreventInnerHTMLUboData,
            [SpecificPlatform.UboExtFirefox]: basePreventInnerHTMLUboData,
        });

        // prevent-innerHTML - should return empty object for ABP (not supported)
        expect(
            scriptletsCompatibilityTable.getMultiple('prevent-innerHTML', GenericPlatform.AbpExtAny),
        ).toEqual({});
    });

    // TODO: Add more tests
});
