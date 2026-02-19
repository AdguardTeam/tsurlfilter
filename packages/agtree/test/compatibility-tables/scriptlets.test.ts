import { describe, it, expect } from 'vitest';

import { scriptletsCompatibilityTable } from '../../src/compatibility-tables/scriptlets';
import { Platform } from '../../src/compatibility-tables';

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
        expect(scriptletsCompatibilityTable.has('abort-current-inline-script')).toBeTruthy();
        expect(scriptletsCompatibilityTable.has('abort-on-property-read')).toBeTruthy();

        // prevent-innerHTML scriptlet
        expect(scriptletsCompatibilityTable.has('prevent-innerHTML')).toBeTruthy();
        expect(scriptletsCompatibilityTable.has('prevent-innerHTML.js')).toBeTruthy();

        expect(scriptletsCompatibilityTable.has('nonexistent')).toBeFalsy();
    });

    it('scriptletsCompatibilityTable.exists', () => {
        expect(
            scriptletsCompatibilityTable.supports('abort-current-inline-script', Platform.AdgExtChrome),
        ).toBeTruthy();
        expect(
            scriptletsCompatibilityTable.supports('nonexistent', Platform.AbpExtChrome),
        ).toBeFalsy();

        expect(
            scriptletsCompatibilityTable.supports('abort-current-inline-script', Platform.AdgExtAny),
        ).toBeTruthy();
        expect(
            scriptletsCompatibilityTable.supports('nonexistent', Platform.AbpExtAny),
        ).toBeFalsy();

        // prevent-innerHTML - AdGuard platforms
        expect(
            scriptletsCompatibilityTable.supports('prevent-innerHTML', Platform.AdgExtAny),
        ).toBeTruthy();
        expect(
            scriptletsCompatibilityTable.supports('prevent-innerHTML', Platform.AdgOsAny),
        ).toBeTruthy();

        // prevent-innerHTML - uBlock Origin platforms
        expect(
            scriptletsCompatibilityTable.supports('prevent-innerHTML.js', Platform.UboExtAny),
        ).toBeTruthy();

        // prevent-innerHTML - should not exist on ABP
        expect(
            scriptletsCompatibilityTable.supports('prevent-innerHTML', Platform.AbpExtChrome),
        ).toBeFalsy();
    });

    it('scriptletsCompatibilityTable.getSingle', () => {
        expect(
            scriptletsCompatibilityTable.get('abort-current-inline-script', Platform.AdgExtChrome),
        ).toMatchObject(baseAbortCurrentInlineScriptData);

        expect(scriptletsCompatibilityTable.get('nonexistent', Platform.AbpExtChrome)).toBeNull();

        // prevent-innerHTML - AdGuard
        expect(
            scriptletsCompatibilityTable.get('prevent-innerHTML', Platform.AdgExtChrome),
        ).toMatchObject(basePreventInnerHTMLAdgData);

        // prevent-innerHTML - uBlock Origin
        expect(
            scriptletsCompatibilityTable.get('prevent-innerHTML.js', Platform.UboExtChrome),
        ).toMatchObject(basePreventInnerHTMLUboData);

        // prevent-innerHTML - should return null for ABP
        expect(
            scriptletsCompatibilityTable.get('prevent-innerHTML', Platform.AbpExtChrome),
        ).toBeNull();
    });

    it('scriptletsCompatibilityTable.getMultiple', () => {
        expect(
            scriptletsCompatibilityTable.queryAll('abort-current-inline-script', Platform.AdgExtAny),
        ).toMatchObject([baseAbortCurrentInlineScriptData]);

        expect(scriptletsCompatibilityTable.queryAll('nonexistent', Platform.AdgExtAny)).toEqual([]);

        // prevent-innerHTML - AdGuard extensions
        expect(
            scriptletsCompatibilityTable.queryAll('prevent-innerHTML', Platform.AdgExtAny),
        ).toMatchObject([basePreventInnerHTMLAdgData]);

        // prevent-innerHTML - uBlock Origin extensions
        expect(
            scriptletsCompatibilityTable.queryAll('prevent-innerHTML.js', Platform.UboExtAny),
        ).toMatchObject([basePreventInnerHTMLUboData]);

        // prevent-innerHTML - should return empty object for ABP (not supported)
        expect(
            scriptletsCompatibilityTable.queryAll('prevent-innerHTML', Platform.AbpExtAny),
        ).toEqual([]);
    });

    it('scriptletsCompatibilityTable.get - isTrusted defaults to false for regular scriptlets', () => {
        const data = scriptletsCompatibilityTable.get(
            'abort-current-inline-script',
            Platform.AdgExtChrome,
        );
        expect(data).not.toBeNull();
        expect(data!.isTrusted).toBe(false);
    });

    it('scriptletsCompatibilityTable.get - isTrusted is true for trusted scriptlets', () => {
        const data = scriptletsCompatibilityTable.get(
            'trusted-click-element',
            Platform.AdgExtChrome,
        );
        expect(data).not.toBeNull();
        expect(data!.isTrusted).toBe(true);
    });

    // TODO: Add more tests
});
