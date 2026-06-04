import browser, { type WebNavigation } from 'webextension-polyfill';

import { AbstractRemoveParamInjectionService } from '../../../common/abstract-remove-param-injection-service';
import { patchHistoryForRemoveParam } from '../../../common/content-script/remove-param-main-world';
import { type FilteringLogInterface } from '../../../common/filtering-log';
import { logger } from '../../../common/utils/logger';
import { type RemoveParamDescriptor } from '../../../common/utils/remove-param-rules';
import { type EngineApi } from '../engine-api';
import { type TabsApi } from '../tabs';

/**
 * MV2 implementation of the $removeparam injection service.
 *
 * Uses `browser.tabs.executeScript` with a `<script>` element bridge to
 * execute code in the main world (since MV2 has no `world: 'MAIN'` option).
 */
export class RemoveParamInjectionService extends AbstractRemoveParamInjectionService {
    /**
     * Bound reference to {@link onTabRemoved} for listener registration.
     */
    private readonly onTabRemovedHandler: (tabId: number) => void;

    /**
     * Bound reference to {@link onHistoryStateUpdated} for listener registration.
     */
    private readonly onHistoryStateUpdatedHandler: (
        details: WebNavigation.OnCommittedDetailsType,
    ) => void;

    /**
     * Creates a new RemoveParamInjectionService.
     *
     * @param tabsApi Tabs API for accessing tab context and injecting scripts.
     * @param engineApi Engine API for matching requests.
     * @param filteringLog Filtering log for publishing $removeparam events.
     */
    constructor(tabsApi: TabsApi, engineApi: EngineApi, filteringLog: FilteringLogInterface) {
        super(tabsApi, engineApi, filteringLog);
        this.onTabRemovedHandler = this.onTabRemoved.bind(this);
        this.onHistoryStateUpdatedHandler = (details: WebNavigation.OnCommittedDetailsType): void => {
            this.onHistoryStateUpdated(details.tabId, details.frameId, details.url);
        };
    }

    /**
     * {@inheritDoc AbstractRemoveParamInjectionService.registerListeners}.
     */
    protected registerListeners(): void {
        browser.webNavigation.onHistoryStateUpdated.addListener(this.onHistoryStateUpdatedHandler);
        browser.tabs.onRemoved.addListener(this.onTabRemovedHandler);
    }

    /**
     * {@inheritDoc AbstractRemoveParamInjectionService.unregisterListeners}.
     */
    protected unregisterListeners(): void {
        browser.webNavigation.onHistoryStateUpdated.removeListener(this.onHistoryStateUpdatedHandler);
        browser.tabs.onRemoved.removeListener(this.onTabRemovedHandler);
    }

    /**
     * @inheritdoc
     * @note Pages with a strict Content-Security-Policy (e.g. `script-src 'none'` or
     * `script-src 'self'` without `'unsafe-inline'`) will silently block the `<script>`
     * element bridge. The `browser.tabs.executeScript` call itself succeeds — the
     * isolated-world code that creates the tag runs fine — so the `.catch()` handler
     * never fires and no error is surfaced to the extension. A missing injection may
     * therefore produce no output and go undetected.
     */
    // eslint-disable-next-line class-methods-use-this
    protected executeInjection(
        tabId: number,
        frameId: number,
        descriptors: RemoveParamDescriptor[],
        nonce: string,
        secret: string,
    ): void {
        const json = JSON.stringify(descriptors);
        const nonceJson = JSON.stringify(nonce);
        const secretJson = JSON.stringify(secret);
        const mainWorldScript = `;(${patchHistoryForRemoveParam.toString()})(${json}, ${nonceJson}, ${secretJson});`;

        // Inject via <script> element so the code runs in the main world.
        // browser.tabs.executeScript runs in the isolated world — we need
        // the page's History.prototype, not the content script's copy.
        // eslint-disable-next-line max-len
        const code = `(function(){var s=document.createElement('script');s.textContent=${JSON.stringify(mainWorldScript)};(document.head||document.documentElement).appendChild(s);s.remove()})()`;

        browser.tabs.executeScript(tabId, {
            code,
            frameId,
            runAt: 'document_start',
            matchAboutBlank: true,
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
        const descsJson = JSON.stringify(descriptors);
        const secretJson = JSON.stringify(secret);
        // eslint-disable-next-line max-len
        const mainWorldCode = `if(typeof window[${JSON.stringify(nonce)}]=="function"){window[${JSON.stringify(nonce)}](${secretJson},${descsJson})}`;

        // Inject a <script> element from the isolated world to execute
        // code in the main world, then remove it immediately.
        // eslint-disable-next-line max-len
        const code = `(function(){var s=document.createElement('script');s.textContent=${JSON.stringify(mainWorldCode)};(document.head||document.documentElement).appendChild(s);s.remove()})()`;

        browser.tabs.executeScript(tabId, {
            code,
            frameId,
            matchAboutBlank: true,
        }).catch((e: unknown) => {
            logger.error('[tsweb.RemoveParamInjectionService.executeUpdate]: failed to send descriptor update:', e);
        });
    }
}
