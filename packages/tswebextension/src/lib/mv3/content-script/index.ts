import { ExtendedCss } from '@adguard/extended-css';

import { MessageType } from '../../common/message-constants';
import { sendAppMessage } from '../../common/content-script/send-app-message';
import type { GetCssPayload } from '../background/messages';
import { logger } from '../utils/logger';

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

(async (): Promise<void> => {
    const payload: GetCssPayload = {
        url: document.location.href,
        referrer: document.referrer,
    };

    const res = await sendAppMessage({
        type: MessageType.GetCss,
        payload,
    });

    logger.debug('[GET_CSS]: result ', res);

    if (res) {
        const { css, extendedCss } = res;
        applyCss(css);
        applyExtendedCss(extendedCss);
    }
})();
