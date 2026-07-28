import {
    beforeEach,
    describe,
    expect,
    test,
} from 'vitest';

/**
 * Pins the AG-265 native-injection contract: the hit marker must travel
 * in a non-inheriting `--adguard-hit` custom property, registered via
 * `@property`, and never leak as visible text — even when the matched
 * rule targets a pseudo-element such as `::before`.
 *
 * Companion to {@link ./css-hits-extended-css.spec.ts}, which pins the
 * legacy `content:` marker on the ExtendedCss transport.
 */
const NATIVE_STYLE = [
    "@property --adguard-hit { syntax: '*'; inherits: false; initial-value: ''; }",
    "div#parent::before { content: 'X' !important; --adguard-hit: 'adguard0%3B1' !important; }",
].join('\n');

describe('Native CSS injection: --adguard-hit invisibility & non-inheritance', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="parent" data-marker="ad">'
            + 'Parent<span id="child">Child</span></div>'
            + '<div id="sibling">Sibling</div>';
    });

    test('marker is not rendered as text and does not inherit to descendants', async () => {
        const style = document.createElement('style');
        style.textContent = NATIVE_STYLE;
        document.head.appendChild(style);

        // Allow registered @property + style apply to settle.
        await new Promise<void>((r) => { setTimeout(r, 50); });

        const parent = document.getElementById('parent') as HTMLElement;
        const child = document.getElementById('child') as HTMLElement;

        // Marker is on the `::before` pseudo's computed style.
        expect(
            getComputedStyle(parent, '::before').getPropertyValue('--adguard-hit').trim(),
        ).toBe("'adguard0%3B1'");
        // Marker did not inherit to regular descendants — they read
        // the registered `initial-value` (the empty string literal).
        expect(
            getComputedStyle(child).getPropertyValue('--adguard-hit').trim(),
        ).toBe("''");
        // User's `content: 'X'` is preserved — no marker leak as text.
        expect(getComputedStyle(parent, '::before').content).toBe('"X"');
    });
});
