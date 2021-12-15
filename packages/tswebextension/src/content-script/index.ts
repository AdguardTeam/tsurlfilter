import browser from 'webextension-polyfill';
import ExtendedCss, { IAffectedElement } from 'extended-css';
export * from './stealth-helper';
export * from './cookie-controller';
import { CssHitsCounter } from './css-hits-counter';

import { elementCollapser } from './element-collapser';
import { MessageType } from '../common';

elementCollapser.start();

// TODO: replace to separate class

const applyExtendedCss = (cssText: string) => {
    // Init css hits counter
    const cssHitsCounter = new CssHitsCounter((stats) => {
        console.debug('Css stats ready');
        console.debug(stats);
    });

    console.debug('CssHitsCounter initialized');

    // Apply extended css stylesheets
    const extendedCss = new ExtendedCss({
        styleSheet: cssText,
        beforeStyleApplied: (el: IAffectedElement) => {
            return cssHitsCounter.countAffectedByExtendedCss(el);
        },
    });

    extendedCss.apply();

    console.debug('Extended css applied');
};

(async function () {
    /**
     * This content script executes in every page frame
     * We find nearest external source in window.top proxy
     * if this prop doesn't exist, read location data in frame context
     * 
     * TODO: more intelligent search with base64 src url support etc.
     */
    const documentUrl = window.top?.location?.href || window.location.href;

    const res = await browser.runtime.sendMessage({
        type: MessageType.GET_EXTENDED_CSS,
        payload: {
            documentUrl,
        },
    }) as string;

    if (res) {
        applyExtendedCss(res);
    }
})();
