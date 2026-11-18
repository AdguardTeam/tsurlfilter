import { Filter, type IFilter } from '@adguard/dnr-converter';

import { extCssInjectedDispose } from '../../../src/lib/common/extcss-apply-fn';
import { EXTCSS_PROTOCOL } from '../../../src/lib/common/extcss-protocol';

export const createFilter = (
    rules: string[],
    filterId: number = 0,
): IFilter => {
    return new Filter(filterId, () => Promise.resolve(rules.join('\n')));
};

/**
 * Disposes the ExtendedCss instance retained in the shared jsdom `window` by
 * `extCssInjectedApply`, forgets it, and clears the DOM.
 *
 * Calls the production disposal function, so the helper cannot drift from the
 * body that runs in the page. The jsdom `window` is shared by every test in a
 * file, so a retained instance (and its MutationObserver) would otherwise leak
 * into the next test.
 */
export const resetExtCssState = (): void => {
    try {
        extCssInjectedDispose(EXTCSS_PROTOCOL);
    } catch {
        // A test may leave an instance whose dispose() throws on purpose. The
        // production function reports that failure instead of hiding it, so the
        // cleanup drops both document keys itself: the instance and the
        // per-node dedupe map belong to the same filtering session.
        const holder = window as unknown as Record<string, unknown>;
        delete holder[EXTCSS_PROTOCOL.instanceKey];
        delete holder[EXTCSS_PROTOCOL.countedHitsKey];
    }

    document.body.innerHTML = '';
};
