import { FilterList, USER_FILTER_ID } from '@adguard/tswebextension/mv3';

import { appState, logger, TS_WEB_EXTENSION } from './state';
import { storage, StorageKeys } from './storage';

/**
 * Saves every rule created via AdGuard Assistant into user rules.
 */
export const subscribeAssistantCreateRule = () => {
    TS_WEB_EXTENSION.onAssistantCreateRule.subscribe((rule) => {
        void (async () => {
            try {
                const originalContent = new FilterList(
                    appState.config!.userrules.content,
                    USER_FILTER_ID,
                    appState.config!.userrules.conversionData,
                ).getOriginalContent();

                const updatedContent = originalContent
                    ? originalContent + '\n' + rule
                    : rule;

                const updatedList = new FilterList(
                    updatedContent,
                    USER_FILTER_ID,
                    appState.config!.userrules.conversionData,
                );

                appState.config!.userrules = {
                    content: updatedList.getContent(),
                    conversionData: updatedList.getConversionData(),
                };

                await TS_WEB_EXTENSION.configure(appState.config!);
                await storage.set(StorageKeys.Config, appState.config);
            } catch (e) {
                logger.error('[tswebexample.assistant]: failed to save rule:', e);
            }
        })();
    });
};
