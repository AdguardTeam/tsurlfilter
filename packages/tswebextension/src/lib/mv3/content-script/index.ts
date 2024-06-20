import { ExtendedCss } from '@adguard/extended-css';

import { MessageType } from '../../common/message-constants';
import { sendAppMessage } from '../../common/content-script/send-app-message';
import { isEmptySrcFrame } from '../../common/utils/is-empty-src-frame';
import type { CosmeticRules } from '../background/engine-api';
import type { GetCssPayload } from '../background/messages';
import { logger } from '../utils/logger';

import { runCookieController } from './cookie-controller';
import { initAssistant } from './assistant';

// TODO: add ElementCollapser.start();

interface CustomWindow extends Window {
    isAssistantInitiated: boolean;
}

declare const global: CustomWindow;

// Init assistant only once
if (!global.isAssistantInitiated) {
    initAssistant();
    global.isAssistantInitiated = true;
}

/**
 * Applies css rules to the page.
 *
 * @param cssRules List of css rules.
 */
const applyCss = (cssRules: string[]): void => {
    if (!cssRules || cssRules.length === 0) {
        return;
    }

    const styleEl = document.createElement('style');
    styleEl.setAttribute('type', 'text/css');
    styleEl.textContent = cssRules.join('');

    (document.head || document.documentElement).appendChild(styleEl);
    logger.debug('[COSMETIC CSS]: applied');
};

/**
 * Applies extended css rules to the page.
 *
 * @param extendedCssRules List of extended css rules.
 */
const applyExtendedCss = (extendedCssRules: string[] | undefined): void => {
    // cssRules may be undefined if there is no extended css rules
    if (!extendedCssRules || extendedCssRules.length === 0) {
        return;
    }

    // Apply extended css rules
    const extendedCss = new ExtendedCss({ cssRules: extendedCssRules });

    extendedCss.apply();

    logger.debug('[EXTENDED CSS]: applied');
};

/**
 * Applies css and extended css rules to the page.
 */
const applyCssRules = async (): Promise<void> => {
    let url = document.location.href;
    const { referrer } = document;

    if (
        window.top
        && window !== window.top
        && isEmptySrcFrame(url)
    ) {
        // error may be thrown during sendAppMessage() if frame url is non-http or non-ws, e.g. 'about:blank'
        // in this case we should get css rules for the main frame
        url = window.top.location.href;
    }

    const payload: GetCssPayload = {
        url,
        referrer,
    };

    let res: CosmeticRules;
    try {
        res = await sendAppMessage({
            type: MessageType.GetCss,
            payload,
        });
    } catch (e) {
        logger.error('[GET_CSS]: error ', e);
        return;
    }

    logger.debug('[GET_CSS]: result ', res);

    if (res) {
        const { css, extendedCss } = res;
        applyCss(css);
        applyExtendedCss(extendedCss);
    }
};

applyCssRules();

// Apply cookie rules from content-script and watch for change document.cookie
runCookieController();
