import { ExtendedCss } from '@adguard/extended-css';

import { MessageType } from '../../common/message-constants';
import { sendAppMessage } from '../../common/content-script/send-app-message';
import type { CosmeticRules } from '../background/engine-api';
import type { GetCssPayload } from '../background/messages';
import { logger } from '../../common/utils/logger';

import { runCookieController } from './cookie-controller';
import { initAssistant } from './assistant';
import { CosmeticController } from './cosmetic-controller';

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

const cosmeticController = new CosmeticController();
cosmeticController.init();

// /**
//  * Applies extended css rules to the page.
//  *
//  * @param extendedCssRules List of extended css rules.
//  */
// const applyExtendedCss = (extendedCssRules: string[] | undefined): void => {
//     // cssRules may be undefined if there is no extended css rules
//     if (!extendedCssRules || extendedCssRules.length === 0) {
//         return;
//     }
//
//     // Apply extended css rules
//     const extendedCss = new ExtendedCss({ cssRules: extendedCssRules });
//
//     extendedCss.apply();
//
//     logger.debug('[tswebextension.applyExtendedCss]: applied');
// };
//
// /**
//  * Gets and applies extended css rules to the page.
//  */
// const applyCssRules = async (): Promise<void> => {
//     const url = window.location.href;
//     const { referrer } = document;
//
//     const payload: GetCssPayload = {
//         url,
//         referrer,
//     };
//
//     let res: CosmeticRules;
//     try {
//         res = await sendAppMessage({
//             type: MessageType.GetCss,
//             payload,
//         });
//     } catch (e) {
//         logger.error(`[tswebextension.applyCssRules]: error on sending ${MessageType.GetCss} message: `, e);
//         return;
//     }
//
//     logger.debug('[tswebextension.applyCssRules]: result: ', res);
//
//     if (res) {
//         const { extendedCss } = res;
//         applyExtendedCss(extendedCss);
//     }
// };
//
// applyCssRules();

// Apply cookie rules from content-script and watch for change document.cookie
runCookieController();
