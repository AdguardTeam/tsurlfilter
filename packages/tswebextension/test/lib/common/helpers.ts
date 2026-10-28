import { Filter, type IFilter } from '@adguard/dnr-converter';

import { extCssInjectedDispose } from '../../../src/lib/common/extcss-apply-fn';
import { EXTCSS_PROTOCOL } from '../../../src/lib/common/message-constants';

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
    extCssInjectedDispose(EXTCSS_PROTOCOL);
    document.body.innerHTML = '';
};
