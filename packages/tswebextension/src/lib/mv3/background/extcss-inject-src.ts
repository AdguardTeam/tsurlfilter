import { type ExtCssConfiguration, ExtendedCss, type IAffectedElement } from '@adguard/extended-css';

/**
 * Self-contained injectable IIFE entry point.
 *
 * Bundled by `tasks/inline-extcss-bundle.ts` into a minified in-memory IIFE
 * exposing `applyExtendedCss` as a function-scoped `var`, then inlined into
 * the body of `applyExtCss` (`extcss-apply-fn.ts`). It imports ONLY the
 * public root export of `@adguard/extended-css` — the library stays a
 * generic DOM-selection engine while this consumer owns its injection
 * payload. Uses a default export so Rollup assigns the function itself to
 * the IIFE global name.
 *
 * Internally calls `init()` before `apply()` so that the native
 * `Node.prototype.textContent` getter is snapshotted before the page can
 * mock it, which is required for the `:contains()` pseudo-class to work
 * correctly in injected scripts.
 *
 * @param cssRules Array of ExtendedCSS rule strings to apply.
 * @param beforeStyleApplied Optional callback invoked for each affected
 * element before its style is set; used for CSS hits statistics.
 *
 * @returns The applied ExtendedCss instance (retained by the caller for
 * later disposal).
 */
const applyExtendedCss = (
    cssRules: string[],
    beforeStyleApplied?: (el: IAffectedElement) => IAffectedElement,
): ExtendedCss => {
    const configuration: ExtCssConfiguration = {
        cssRules,
        beforeStyleApplied,
    };

    const extendedCss = new ExtendedCss(configuration);
    extendedCss.init();
    extendedCss.apply();

    return extendedCss;
};

export default applyExtendedCss;
