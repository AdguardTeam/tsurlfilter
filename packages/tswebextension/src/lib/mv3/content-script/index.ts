import ExtendedCss from 'extended-css';

/* eslint-disable no-console */
import { MessageType } from '../../common/message-constants';
import { sendAppMessage } from '../../common/content-script/send-app-message';

const applyCss = (cssContent: string): void => {
    if (!cssContent || cssContent.length === 0) {
        return;
    }

    const styleEl = document.createElement('style');
    styleEl.setAttribute('type', 'text/css');
    styleEl.textContent = cssContent;

    (document.head || document.documentElement).appendChild(styleEl);
    console.debug('[COSMETIC CSS]: applied');
};

const applyExtendedCss = (cssText: string): void => {
    if (!cssText || cssText.length === 0) {
        return;
    }

    // Apply extended css stylesheets
    const extendedCss = new ExtendedCss({
        styleSheet: cssText,
    });

    extendedCss.apply();

    console.debug('[EXTENDED CSS]: applied');
};

(async (): Promise<void> => {
    const res = await sendAppMessage({
        type: MessageType.GET_CSS,
        payload: {
            url: document.location.href,
        },
    });

    console.debug('[GET_CSS]: result ', res);

    if (res) {
        const { css, extendedCss } = res;
        applyCss(css?.join(''));
        applyExtendedCss(extendedCss?.join(''));
    }
})();
