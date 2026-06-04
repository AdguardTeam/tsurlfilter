import { AbstractRemoveParamInjectionService } from '../../../common/abstract-remove-param-injection-service';
import { patchHistoryForRemoveParam } from '../../../common/content-script/remove-param-main-world';
import { defaultFilteringLog } from '../../../common/filtering-log';
import { logger } from '../../../common/utils/logger';
import { type RemoveParamDescriptor } from '../../../common/utils/remove-param-rules';
import { tabsApi } from '../../tabs/tabs-api';
import { engineApi } from '../engine-api';
import { ScriptingApi } from '../scripting-api';

import type { LocalScriptFunction } from './local-script-rules-service';

/**
 * MV3 implementation of the $removeparam injection service.
 *
 * Uses `ScriptingApi.executeScriptFunc` (which wraps `chrome.scripting.executeScript`
 * with `world: 'MAIN'`) for both initial injection and descriptor updates.
 */
export class RemoveParamInjectionService extends AbstractRemoveParamInjectionService {
    /**
     * Bound handler for `chrome.webNavigation.onHistoryStateUpdated`.
     *
     * @param details Web navigation event details.
     */
    private readonly handleHistoryStateUpdated = (
        details: chrome.webNavigation.WebNavigationFramedCallbackDetails,
    ): void => {
        this.onHistoryStateUpdated(details.tabId, details.frameId, details.url);
    };

    /**
     * Bound handler for `chrome.tabs.onRemoved`.
     *
     * @param tabId Removed tab identifier.
     */
    private readonly handleTabRemoved = (tabId: number): void => {
        this.onTabRemoved(tabId);
    };

    /**
     * @inheritdoc
     */
    protected registerListeners(): void {
        chrome.webNavigation.onHistoryStateUpdated.addListener(this.handleHistoryStateUpdated);
        chrome.tabs.onRemoved.addListener(this.handleTabRemoved);
    }

    /**
     * @inheritdoc
     */
    protected unregisterListeners(): void {
        chrome.webNavigation.onHistoryStateUpdated.removeListener(this.handleHistoryStateUpdated);
        chrome.tabs.onRemoved.removeListener(this.handleTabRemoved);
    }

    /**
     * @inheritdoc
     */
    // eslint-disable-next-line class-methods-use-this
    protected executeInjection(
        tabId: number,
        frameId: number,
        descriptors: RemoveParamDescriptor[],
        nonce: string,
        secret: string,
    ): void {
        ScriptingApi.executeScriptFunc({
            tabId,
            frameId,
            scriptFunction: patchHistoryForRemoveParam as LocalScriptFunction,
            args: [descriptors, nonce, secret],
        }).catch((e) => {
            logger.error('[tsweb.RemoveParamInjectionService.executeInjection]: failed to inject removeparam script:', e);
        });
    }

    /**
     * @inheritdoc
     */
    // eslint-disable-next-line class-methods-use-this
    protected executeUpdate(
        tabId: number,
        frameId: number,
        secret: string,
        descriptors: RemoveParamDescriptor[],
        nonce: string,
    ): void {
        const scriptFunction = (token: string, descs: RemoveParamDescriptor[], nonceProp: string): void => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updater = (window as any)[nonceProp];
            if (typeof updater === 'function') {
                updater(token, descs);
            }
        };

        ScriptingApi.executeScriptFunc({
            tabId,
            frameId,
            scriptFunction: scriptFunction as LocalScriptFunction,
            args: [secret, descriptors, nonce],
        }).catch((e) => {
            logger.error('[tsweb.RemoveParamInjectionService.executeUpdate]: failed to send descriptor update:', e);
        });
    }
}

/**
 * Singleton instance of the MV3 remove-param injection service.
 */
export const removeParamInjectionService = new RemoveParamInjectionService(tabsApi, engineApi, defaultFilteringLog);
