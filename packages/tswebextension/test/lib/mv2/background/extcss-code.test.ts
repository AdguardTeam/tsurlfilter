/**
 * @vitest-environment jsdom
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInThisContext, Script } from 'node:vm';

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { EXTCSS_PROTOCOL, type ExtCssProtocol } from '../../../../src/lib/common/message-constants';
import { serializeExtCssDisposeForCode, serializeExtCssForCode } from '../../../../src/lib/mv2/background/extcss-code';
import { APPLY_FN_MAX_BYTES } from '../../common/extcss-payload-size';

// Resolve the serializer source path relative to THIS test file's directory.
// `readFileSync` resolves relative paths against `process.cwd()` (the package
// root under `pnpm test:mv2`), and `new URL(rel, import.meta.url)` is
// unreliable here because the jsdom test environment makes the URL constructor
// resolve to `http://localhost:3000/...`. Converting `import.meta.url` to a
// real path and joining with `node:path` is robust regardless of the working
// directory.
const SERIALIZER_PATH = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../../src/lib/mv2/background/extcss-code.ts',
);

/**
 * Returns the serializer source with block and line comments removed, so a
 * comment that names a forbidden API does not trip the source guard.
 *
 * @returns The serializer source without comments.
 */
const readSerializerSourceWithoutComments = (): string => readFileSync(SERIALIZER_PATH, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

/**
 * Returns the ExtendedCss instance retained on `window` under `key`.
 *
 * @param key Retained-instance key.
 *
 * @returns The retained instance, or null when nothing was applied.
 */
const getRetainedInstance = (key: string): { dispose(): void; cssRules?: string[] } | null => {
    const holder = window as unknown as Record<string, { dispose(): void; cssRules?: string[] } | null | undefined>;
    return holder[key] ?? null;
};

/**
 * Disposes and forgets any instance retained on the shared jsdom `window`.
 *
 * @param key Retained-instance key.
 */
const resetRetainedInstance = (key: string): void => {
    const instance = getRetainedInstance(key);

    if (instance) {
        try {
            instance.dispose();
        } catch {
            // ignore
        }
    }

    (window as unknown as Record<string, null>)[key] = null;
};

describe('extcss-code serializer', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        resetRetainedInstance(EXTCSS_PROTOCOL.instanceKey);
        vi.spyOn(chrome.runtime, 'sendMessage');
    });

    afterEach(() => {
        resetRetainedInstance(EXTCSS_PROTOCOL.instanceKey);
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('serializes an apply call with the payload source and JSON arguments', () => {
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const code = serializeExtCssForCode(rules, false, EXTCSS_PROTOCOL);

        expect(code.startsWith('(')).toBe(true);
        expect(code.endsWith(');')).toBe(true);
        expect(code).toContain(JSON.stringify(rules));
        expect(() => new Script(code)).not.toThrow();

        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';
        runInThisContext(code);

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');
        expect(ad.style.getPropertyPriority('display')).toBe('important');
    });

    it('escapes raw U+2028 and U+2029 in the serialized arguments', () => {
        const rules = [
            '.ad:contains("line\u2028separator\u2029end") { display: none !important; }',
        ];
        const code = serializeExtCssForCode(rules, false, EXTCSS_PROTOCOL);

        expect(code).toContain('\\u2028');
        expect(code).toContain('\\u2029');
        expect(code).not.toContain('\u2028');
        expect(code).not.toContain('\u2029');
        expect(() => new Script(code)).not.toThrow();

        document.body.innerHTML = '<div class="ad">ad</div>';
        runInThisContext(code);

        const instance = getRetainedInstance(EXTCSS_PROTOCOL.instanceKey);
        expect(instance?.cssRules).toEqual(rules);
    });

    it('preserves quotes, backslashes, and newlines in rule strings', () => {
        const rules = [
            '.ad[data-x="a\\b"] {\n    display: none !important;\n}',
        ];
        const code = serializeExtCssForCode(rules, false, EXTCSS_PROTOCOL);

        document.body.innerHTML = '<div class="ad">ad</div>';
        runInThisContext(code);

        const instance = getRetainedInstance(EXTCSS_PROTOCOL.instanceKey);
        expect(instance?.cssRules).toEqual(rules);
    });

    it('embeds the protocol values as JSON', () => {
        // The protocol fields are typed with the shared literal types, so a
        // custom object needs a cast. The serializer must still pass any
        // protocol object through as JSON, and the payload must use its
        // `instanceKey`.
        const protocol = {
            markerPrefix: 'customPrefix',
            handlerName: 'customHandler',
            messageType: 'customMessage',
            instanceKey: '__customExtCss',
        } as unknown as ExtCssProtocol;
        const rules = ['.ad:has(.child) { display: none !important; }'];
        const code = serializeExtCssForCode(rules, false, protocol);

        expect(code).toContain(JSON.stringify(protocol));

        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';
        runInThisContext(code);

        expect(getRetainedInstance(protocol.instanceKey)).not.toBeNull();
        resetRetainedInstance(protocol.instanceKey);
    });

    it('serializes an empty rule set as a valid apply call', () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';
        runInThisContext(serializeExtCssForCode(
            ['.ad:has(.child) { display: none !important; }'],
            false,
            EXTCSS_PROTOCOL,
        ));

        const previous = getRetainedInstance(EXTCSS_PROTOCOL.instanceKey);
        const disposeSpy = vi.spyOn(previous!, 'dispose');

        expect(() => {
            runInThisContext(serializeExtCssForCode([], false, EXTCSS_PROTOCOL));
        }).not.toThrow();
        expect(disposeSpy).toHaveBeenCalledTimes(1);
    });

    it('serializes a dispose call that disposes the retained instance', () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';
        runInThisContext(serializeExtCssForCode(
            ['.ad:has(.child) { display: none !important; }'],
            false,
            EXTCSS_PROTOCOL,
        ));

        const ad = document.querySelector('.ad') as HTMLElement;
        expect(ad.style.getPropertyValue('display')).toBe('none');

        runInThisContext(serializeExtCssDisposeForCode(EXTCSS_PROTOCOL));

        expect(ad.style.getPropertyValue('display')).toBe('');
        expect(getRetainedInstance(EXTCSS_PROTOCOL.instanceKey)).toBeNull();
    });

    it('produces syntactically valid JavaScript for apply and dispose', () => {
        const applyCode = serializeExtCssForCode(
            ['.ad:has(.child) { display: none !important; }'],
            true,
            EXTCSS_PROTOCOL,
        );
        const disposeCode = serializeExtCssDisposeForCode(EXTCSS_PROTOCOL);

        expect(() => new Script(applyCode)).not.toThrow();
        expect(() => new Script(disposeCode)).not.toThrow();
    });

    it('does not use eval or new Function in the serializer source', () => {
        const source = readSerializerSourceWithoutComments();

        expect(source).not.toContain('eval(');
        expect(source).not.toContain('new Function(');
    });

    it('keeps the apply code string under the payload size cap', () => {
        const code = serializeExtCssForCode(
            ['.ad:has(.child) { display: none !important; }'],
            false,
            EXTCSS_PROTOCOL,
        );

        expect(Buffer.byteLength(code, 'utf8')).toBeLessThan(APPLY_FN_MAX_BYTES);
    });

    it('executes the apply code with hits collection and sends SaveCssHitsStats', async () => {
        document.body.innerHTML = '<div class="ad"><span class="child">ad</span></div>';

        runInThisContext(serializeExtCssForCode(
            ['.ad:has(.child) { display: none !important; content: \'adguard1%3B2\' !important; }'],
            true,
            EXTCSS_PROTOCOL,
        ));

        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });

        expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
            handlerName: 'tsWebExtension',
            type: 'saveCssHitsStats',
            payload: [{ filterId: 1, ruleIndex: 2, element: '<div class="ad">' }],
        });
    });

    it('applies uBO action pseudo-classes from the serialized code', () => {
        // The MV2 content script no longer instantiates ExtendedCss, so the
        // action pseudo-classes are applied only through this code string.
        document.body.innerHTML = '<a id="link" href="https://example.org/" onclick="void 0" class="ads ad-1 other">link</a>';

        runInThisContext(serializeExtCssForCode(
            [
                'a:remove-attr(href)',
                'a:remove-attr(/^on[a-z]+$/)',
                'a:remove-class(ads)',
                'a:remove-class(/^ad-[0-9]+$/)',
            ],
            false,
            EXTCSS_PROTOCOL,
        ));

        const link = document.getElementById('link') as HTMLAnchorElement;
        expect(link.hasAttribute('href')).toBe(false);
        expect(link.hasAttribute('onclick')).toBe(false);
        expect(link.classList.contains('ads')).toBe(false);
        expect(link.classList.contains('ad-1')).toBe(false);
        // Unrelated classes and the element itself are kept
        expect(link.classList.contains('other')).toBe(true);
        expect(link.style.getPropertyValue('display')).toEqual('');
    });
});
