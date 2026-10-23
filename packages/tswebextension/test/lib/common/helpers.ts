import { Filter, type IFilter } from '@adguard/dnr-converter';

import { EXTCSS_PROTOCOL } from '../../../src/lib/common/message-constants';

export const createFilter = (
    rules: string[],
    filterId: number = 0,
): IFilter => {
    return new Filter(filterId, () => Promise.resolve(rules.join('\n')));
};

/**
 * ExtendedCss instance retained on `window` by the injected function.
 */
type RetainedExtCss = {
    /**
     * Reverts the applied styles and disconnects the instance's observers.
     */
    dispose(): void;
};

/**
 * Disposes the ExtendedCss instance retained in the shared jsdom `window` by
 * `extCssInjectedApply`, forgets it, and clears the DOM.
 *
 * The jsdom `window` is shared by every test in a file, so a retained instance
 * (and its MutationObserver) would otherwise leak into the next test.
 */
export const resetExtCssState = (): void => {
    const w = window as unknown as Record<string, RetainedExtCss | null | undefined>;
    const handle = w[EXTCSS_PROTOCOL.instanceKey];

    if (handle) {
        try {
            handle.dispose();
        } catch {
            // ignore
        }
    }

    w[EXTCSS_PROTOCOL.instanceKey] = null;
    document.body.innerHTML = '';
};
