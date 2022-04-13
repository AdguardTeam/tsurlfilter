/* eslint-disable no-console */
import { MessageType, sendAppMessage } from '../../common';

// TODO: Add extended css
// TODO: It helps only with Force refresh (via drop cache).
// For just F5 - cosmetic css won't be applied
const applyCss = (cssContent: string) => {
    if (!cssContent || cssContent.length === 0) {
        return;
    }

    const styleEl = document.createElement('style');
    styleEl.setAttribute('type', 'text/css');
    styleEl.textContent = cssContent;

    (document.head || document.documentElement).appendChild(styleEl);
};

(async () => {
    const res = await sendAppMessage({
        type: MessageType.GET_CSS,
        payload: {
            url: document.location.href,
        },
    });

    console.debug('GET_CSS result: ', res);

    if (res) {
        applyCss(res?.css.join(''));
    }
})();
