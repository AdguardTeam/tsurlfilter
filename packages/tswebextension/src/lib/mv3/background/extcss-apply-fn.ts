// Type-only declarations for symbols that exist only after build-time inlining.
// The `inlineExtCssBundle` plugin replaces the inlining marker call below with
// the minified @adguard/extended-css apply IIFE, which defines `applyExtendedCss`
// as a function-scoped `var` inside `applyExtCss`. Both declarations below are
// erased at runtime; they exist only so the source type-checks before inlining.
// eslint-disable-next-line @typescript-eslint/naming-convention -- build-time marker, replaced by the inliner
declare function __INLINE_EXTCSS_BUNDLE__(): void;

/**
 * Shape of the retained ExtendedCss instance. Only `dispose()` is used; it
 * disconnects the main MutationObserver and reverts applied styles.
 */
type ExtCssInstance = { dispose(): void };

/**
 * Type-only mirror of the IAffectedElement the @adguard/extended-css apply IIFE
 * passes to beforeStyleApplied (see src/index.apply.ts / extended-css.ts).
 * Erased at runtime; the behavioral test pins the real shape.
 */
type IAffectedElement = {
    node?: Element;
    rules?: { style?: { content?: string } }[];
};

/**
 * The apply IIFE entry returns the applied ExtendedCss instance and accepts an
 * optional beforeStyleApplied callback (used for CSS hits statistics).
 */
declare const applyExtendedCss: (
    cssRules: string[],
    beforeStyleApplied?: (el: IAffectedElement) => IAffectedElement,
) => ExtCssInstance;

/**
 * Self-contained ExtendedCSS apply function injected into pages via
 * `chrome.scripting.executeScript({ func, args })`.
 *
 * IMPORTANT: this function is NEVER called in the service worker. It is
 * serialized via `toString()` and executed in the page's ISOLATED world. It
 * MUST NOT reference any outer-scope variable — only literal source inside this
 * body (and the global `window`) survives serialization. The
 * `inlineExtCssBundle` build plugin replaces the inlining marker call with
 * the minified `@adguard/extended-css` apply IIFE, which defines
 * `applyExtendedCss` as a function-scoped `var`.
 *
 * Navigation cleanup (PRD US2 scenario 2): before applying a new instance, the
 * previously retained instance (if any) is disposed. `dispose()` disconnects
 * the prior `MutationObserver` and reverts its styles, so no stale/duplicate
 * observers leak across same-document (SPA) re-injections. This runs only on
 * re-injection (the next `onCommitted` with matching rules); full page loads
 * tear down the world, so no disposal is needed there.
 *
 * The active instance is retained on `window` under a string key that is
 * inlined directly in this body (NOT a module-scope const), so it is part of
 * the serialized source and resolves correctly in the ISOLATED world. The
 * self-containment is guarded by a unit test (`String(applyExtCss)`).
 *
 * CSS-hits reporting: when `collectStats` is true, a self-contained
 * `beforeStyleApplied` callback is registered. It parses the `content` style
 * marker (`adguard{filterId}%3B{ruleIndex}`) that the engine appends to rules
 * built with hits stats, serializes the matched element, and sends a
 * `SaveCssHitsStats` message to the background via `chrome.runtime.sendMessage`
 * (the same message shape the MV2 content script uses). The parsing mirrors the
 * MV2 reference (`ElementUtils.parseExtendedStyleInfo`): strip `!important`
 * FIRST, then decode, then remove quotes, then strip the `adguard` prefix. When
 * `collectStats` is false, no callback is registered and no overhead is
 * incurred.
 *
 * @param cssRules ExtendedCSS rule strings to apply to the current document.
 * @param collectStats Whether to register the CSS-hits `beforeStyleApplied`
 * callback. Defaults to false.
 */
export const applyExtCss = (cssRules: string[], collectStats = false): void => {
    __INLINE_EXTCSS_BUNDLE__();

    // NOTE: the instance key is a literal here on purpose, NOT a module-scope
    // const — only literal source inside this body survives Function.toString()
    // serialization (a module-scope const would be a free identifier in the
    // page's ISOLATED world). The self-containment test guards this.
    const w = window as unknown as Record<string, ExtCssInstance | null | undefined>;

    // Dispose the previous instance (if any) before applying a new one.
    // eslint-disable-next-line @typescript-eslint/dot-notation -- bracket keeps the key a verbatim string literal
    const previous = w['__adguardExtCss'];
    if (previous) {
        try {
            previous.dispose();
        } catch {
            // Ignore disposal errors; the new instance is applied regardless.
        }
    }

    // CSS-hits callback. Defined inline because only source inside this body
    // survives executeScript serialization (a module-scope function would be a
    // free identifier in the page's ISOLATED world). Mirrors
    // ElementUtils.parseExtendedStyleInfo -> parseInfo (strip !important FIRST,
    // then decode, then remove quotes, then strip prefix) + elementToString;
    // keep in sync (guarded by the behavioral test).
    const beforeStyleApplied = (el: IAffectedElement): IAffectedElement => {
        const PREFIX = 'adguard';
        const hits: { filterId: number; ruleIndex: number; element: string }[] = [];

        if (el && el.rules) {
            for (const rule of el.rules) {
                const content = rule && rule.style && rule.style.content;
                if (!content || content.indexOf(PREFIX) < 0) {
                    continue;
                }

                let c = content;

                // 1. Strip trailing !important FIRST. MUST happen before the
                //    quote-strip step: while !important still trails, the
                //    first/last chars are the opening quote and 't', so
                //    removeQuotes would not match and the prefix check below
                //    would fail, silently dropping the hit.
                const imp = c.lastIndexOf('!important');
                if (imp !== -1) {
                    c = c.substring(0, imp).trim();
                }

                // 2. URI-decode; the ';' separator is encoded as %3B by
                //    buildStyleSheetsWithHits.
                c = decodeURIComponent(c);

                // 3. Remove wrapping quotes (mirrors removeQuotes).
                if (c.length > 1
                    && ((c[0] === '"' && c[c.length - 1] === '"')
                        || (c[0] === '\'' && c[c.length - 1] === '\''))) {
                    c = c.substring(1, c.length - 1);
                }
                if (c.indexOf(PREFIX) !== 0) {
                    continue;
                }
                c = c.substring(PREFIX.length);
                const sep = c.indexOf(';');
                if (sep < 0) {
                    continue;
                }
                const filterId = parseInt(c.slice(0, sep), 10);
                const ruleIndex = parseInt(c.slice(sep + 1), 10);
                if (Number.isNaN(filterId) || Number.isNaN(ruleIndex)) {
                    continue;
                }

                // Serialize element (mirrors ElementUtils.elementToString).
                // Build `<tagname attrs>` with a SINGLE trailing '>'; the tag
                // is left open while attributes are appended, then closed once.
                const { node } = el;
                let elementStr = `<${node ? node.localName : 'div'}`;
                if (node && node.attributes) {
                    for (let i = 0; i < node.attributes.length; i += 1) {
                        const { name, value } = node.attributes[i];
                        elementStr += ` ${name}="${(value || '').replace(/"/g, '\\"')}"`;
                    }
                }
                elementStr += '>';

                hits.push({ filterId, ruleIndex, element: elementStr });
                // Clear to avoid duplicate counting on re-style.
                if (rule.style) {
                    rule.style.content = '';
                }
            }
        }

        if (hits.length > 0) {
            // Fire-and-forget: hits reporting must never throw out of
            // beforeStyleApplied and disrupt styling. The service worker may
            // be inactive or the page tearing down, in which case
            // sendMessage rejects — swallow it.
            try {
                chrome.runtime.sendMessage({
                    handlerName: 'tsWebExtension',
                    type: 'saveCssHitsStats',
                    payload: hits,
                });
            } catch (e) {
                /* ignore — see comment above */
            }
        }

        return el;
    };

    // Retain the new instance so the next call can dispose it.
    // eslint-disable-next-line @typescript-eslint/dot-notation -- bracket keeps the key a verbatim string literal
    w['__adguardExtCss'] = collectStats
        ? applyExtendedCss(cssRules, beforeStyleApplied)
        : applyExtendedCss(cssRules);
};
