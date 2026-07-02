// Type-only decls for symbols supplied by build-time inlining (see the
// inlineExtCssBundle plugin). Erased at runtime; they exist only so the source
// type-checks before the inliner swaps in the real definitions.
// eslint-disable-next-line @typescript-eslint/naming-convention -- build-time marker, replaced by the inliner
declare function __INLINE_EXTCSS_BUNDLE__(): void;

/**
 * Retained ExtendedCss instance; only `dispose()` is used — it disconnects
 * the main MutationObserver and reverts applied styles.
 */
type ExtCssInstance = { dispose(): void };

/**
 * Type-only mirror of IAffectedElement from the extended-css apply IIFE (see
 * src/index.apply.ts). Erased at runtime; the behavioral test pins the real shape.
 */
type IAffectedElement = {
    node?: Element;
    rules?: { style?: { content?: string } }[];
};

/**
 * The apply IIFE entry: returns the applied ExtendedCss instance, accepts an
 * optional beforeStyleApplied callback (for CSS-hits stats).
 */
declare const applyExtendedCss: (
    cssRules: string[],
    beforeStyleApplied?: (el: IAffectedElement) => IAffectedElement,
) => ExtCssInstance;

/**
 * Self-contained ExtendedCSS apply function injected into pages via
 * `chrome.scripting.executeScript({ func, args })`.
 *
 * NEVER called in the service worker — it is serialized by `toString()` and
 * re-evaluated in the page's ISOLATED world, so it MUST NOT reference any
 * outer-scope identifier: only literal source in this body (and `window`)
 * survives. The `inlineExtCssBundle` build plugin replaces the inlining
 * marker call below with the minified @adguard/extended-css apply IIFE, which
 * defines `applyExtendedCss` as a function-scoped `var`. Self-containment is
 * pinned by the `String(applyExtCss)` unit tests.
 *
 * @param cssRules ExtendedCSS rule strings to apply to the current document.
 * @param collectStats When true, register a CSS-hits `beforeStyleApplied`
 * callback (else nothing is registered and no overhead is incurred).
 */
export const applyExtCss = (cssRules: string[], collectStats = false): void => {
    __INLINE_EXTCSS_BUNDLE__();

    // Key must be a body literal, not a module-scope const: only body literals
    // survive toString() serialization — a module-scope const would be an
    // unresolved free identifier in the page's ISOLATED world.
    const w = window as unknown as Record<string, ExtCssInstance | null | undefined>;

    // Dispose the previous instance before applying a new one. dispose()
    // disconnects the prior MutationObserver and reverts styles, preventing
    // stale observer/style leaks on same-document (SPA) re-injections (full
    // page loads tear down the world, so this only matters then).
    //
    // Caveat: `window` is world-scoped (ScriptingApi -> ISOLATED,
    // UserScriptsApi -> USER_SCRIPT), so disposal can't cross worlds; a
    // userScripts-permission flip would orphan the old instance, but such
    // flips reload the tab.
    // eslint-disable-next-line @typescript-eslint/dot-notation -- bracket keeps the key a verbatim string literal
    const previous = w['__adguardExtCss'];
    if (previous) {
        try {
            previous.dispose();
        } catch {
            // Ignore disposal errors; the new instance is applied regardless.
        }
    }

    // CSS-hits callback, inlined (module functions don't survive serialization).
    // Mirrors MV2's ElementUtils.parseExtendedStyleInfo -> parseInfo +
    // elementToString; keep in sync — the behavioral test pins the contract.
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

                // Strip trailing !important FIRST. Order is load-bearing: while
                // it still trails, the string's first/last chars are the opening
                // quote and 't', so the removeQuotes step below wouldn't match
                // and the prefix check would silently drop the hit.
                const imp = c.lastIndexOf('!important');
                if (imp !== -1) {
                    c = c.substring(0, imp).trim();
                }

                // URI-decode (';' is encoded as %3B by buildStyleSheetsWithHits).
                c = decodeURIComponent(c);

                // Remove wrapping quotes (mirrors removeQuotes).
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

                // Serialize element (mirrors ElementUtils.elementToString):
                // build `<tagname attrs>` with a single trailing '>'.
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
            // Fire-and-forget: must never throw out of beforeStyleApplied. In
            // MV3 sendMessage returns a Promise, so a synchronous try/catch
            // cannot catch its async rejection — which would otherwise surface
            // as an unhandled rejection in the page on every hit while the SW
            // is asleep. Promise.resolve() also guards the rare sync-throw;
            // .catch() swallows both.
            Promise.resolve(
                chrome.runtime.sendMessage({
                    handlerName: 'tsWebExtension',
                    type: 'saveCssHitsStats',
                    payload: hits,
                }),
            ).catch(() => {
                /* ignore */
            });
        }

        return el;
    };

    // Retain the new instance so the next call can dispose it.
    // eslint-disable-next-line @typescript-eslint/dot-notation -- bracket keeps the key a verbatim string literal
    w['__adguardExtCss'] = collectStats
        ? applyExtendedCss(cssRules, beforeStyleApplied)
        : applyExtendedCss(cssRules);
};
