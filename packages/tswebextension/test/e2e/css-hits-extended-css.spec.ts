import {
    beforeEach,
    describe,
    expect,
    test,
} from 'vitest';

import { ExtendedCss } from '@adguard/extended-css';

import { CssHitsCounter } from '../../src/lib/common/content-script/css-hits-counter';

/**
 * Validates the ExtendedCss transport contract for hit markers.
 *
 * AG-265 only affected the *native* CSS injection path (`<style>` tag)
 * where `content: 'adguard…'` on a pseudo-element selector rendered the
 * marker as visible text. The ExtendedCss path was never affected: its
 * `cssRules` are parsed into JS objects and applied imperatively. The
 * marker travels in the parsed rule object, the counter reads
 * `rule.style.content`, and the counter blanks it before
 * `setStyleToElement` writes anything to the DOM. Therefore the marker
 * never reaches computed style — neither the matched host nor any
 * descendant ever exposes it.
 *
 * These specs pin that contract: the legacy `content:` marker must keep
 * working on the ExtendedCss path even after AG-265 changes the native
 * path to `--adguard-hit` + `@property`.
 */
const EXT_RULE = "div#parent:has(> #child) { display: block !important; content: 'adguard0%3B1' !important; }";

describe('CssHitsCounter + ExtendedCss (legacy content marker)', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="parent" data-marker="ad">'
            + 'Parent<span id="child">Child</span></div>'
            + '<div id="sibling">Sibling</div>';
    });

    test('marker never reaches the DOM after ExtendedCss apply', async () => {
        const counter = new CssHitsCounter(() => { /* noop */ });

        const extCss = new ExtendedCss({
            cssRules: [EXT_RULE],
            beforeStyleApplied: counter.countAffectedByExtendedCss.bind(counter),
        });
        extCss.apply();

        // Give ExtendedCss one task tick to apply styles.
        await new Promise<void>((r) => { setTimeout(r, 50); });

        const parent = document.getElementById('parent') as HTMLElement;
        const child = document.getElementById('child') as HTMLElement;

        // The counter is expected to have blanked rule.style.content
        // before apply, so neither host nor descendants render the marker
        // text via `content`.
        expect(getComputedStyle(parent).content).toBe('normal');
        expect(getComputedStyle(child).content).toBe('normal');
    });

    test('CssHitsCounter reports exactly one hit for the matched parent', async () => {
        const collected: { filterId: number; ruleIndex: number }[] = [];
        const counter = new CssHitsCounter((batch) => {
            for (const { filterId, ruleIndex } of batch) {
                collected.push({ filterId, ruleIndex });
            }
        });

        const extCss = new ExtendedCss({
            cssRules: [EXT_RULE],
            beforeStyleApplied: counter.countAffectedByExtendedCss.bind(counter),
        });
        extCss.apply();

        // Wait for ExtendedCss application to settle.
        await new Promise<void>((r) => { setTimeout(r, 200); });

        counter.stop();
        expect(collected).toHaveLength(1);
        expect(collected[0]).toEqual({ filterId: 0, ruleIndex: 1 });
    });
});
