import browser, { WebRequest } from 'webextension-polyfill';
import { StringRuleList, logger } from '@adguard/tsurlfilter';
import { Configuration } from './configuration';
import { StealthConfig, StealthService } from './services/stealth-service';
import { RequestContext, requestContextStorage } from './request/request-context-storage';
import { FilteringLog, mockFilteringLog } from './filtering-log';

/**
 * Stealth api
 */
export interface StealthApiInterface {
    start: (configuration: Configuration) => void;
    stop: () => void;
}

/**
 * Stealth api implementation
 */
export class StealthApi implements StealthApiInterface {
    /**
     * Privacy permission for block webrtc stealth setting
     */
    private static PRIVACY_PERMISSIONS = {
        permissions: ['privacy'],
    };

    /**
     * Stealth filter identifier
     */
    private static STEALTH_MODE_FILTER_ID: -1;

    /**
     * Stealth configuration
     */
    private configuration: StealthConfig | undefined;

    /**
     * Stealth service
     */
    private engine: StealthService | undefined;

    /**
     * Filtering log
     */
    private filteringLog: FilteringLog;

    constructor(filteringLog: FilteringLog){
        this.filteringLog = filteringLog;
    }

    /**
     * Starts service
     *
     * @param configuration
     */
    public async start(configuration: Configuration): Promise<void> {
        this.configuration = {
            ...configuration.settings.stealth,
        } as StealthConfig;

        this.engine = new StealthService(this.configuration);

        const filter: WebRequest.RequestFilter = {
            urls: ['<all_urls>'],
        };

        browser.webRequest.onBeforeSendHeaders.addListener(this.onBeforeSendHeaders, filter);

        if (this.canBlockWebRTC()) {
            let isPermissionsGranted = false;
            try {
                isPermissionsGranted = await browser.permissions.contains(StealthApi.PRIVACY_PERMISSIONS);
            } catch (e) {
                logger.error((e as Error).message);
            }

            if (isPermissionsGranted) {
                await this.handleBlockWebRTC();
            }
        }
    }

    /**
     * Stops service
     */
    public stop():void {
        browser.webRequest.onBeforeSendHeaders.removeListener(this.onBeforeSendHeaders);
    }

    /**
     * Returns rule list with stealth mode rules
     * @return {StringRuleList}
     */
    public getStealthModeRuleList(): StringRuleList | null {
        if (!this.engine) {
            return null;
        }

        const rulesTexts = this.engine.getCookieRulesTexts().join('\n');
        return new StringRuleList(StealthApi.STEALTH_MODE_FILTER_ID, rulesTexts, false, false);
    }

    /**
     * Handler
     *
     * @param details
     */
    private onBeforeSendHeaders(details: WebRequest.OnBeforeSendHeadersDetailsType):void {
        if (!this.engine) {
            return;
        }

        if (!details.requestHeaders) {
            return;
        }

        const context = requestContextStorage.get(details.requestId);
        if (!context) {
            return;
        }

        if (!this.canApplyStealthActionsToContext(context)) {
            return;
        }

        const stealthActions = this.engine.processRequestHeaders(
            context.requestUrl!,
            context.requestType!,
            details.requestHeaders,
        );

        if (stealthActions > 0) {
            this.filteringLog.bindStealthActionsToHttpRequestEvent(context.tabId, context.requestId, stealthActions);
        }
    }

    private canApplyStealthActionsToContext(context: RequestContext): boolean {
        // TODO: Missing config field
        // if (isStealthModeDisabled()) {
        //     return false;
        // }

        const matchingResult = context.matchingResult;
        if (matchingResult) {
            if (matchingResult.documentRule || matchingResult.stealthRule) {
                return false;
            }
        }

        return true;
    }

    private canBlockWebRTC() {
        // Edge doesn't support privacy api
        // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/privacy
        return !!browser.privacy;
    }

    private logError(e: Error) {
        logger.error(`Error updating privacy.network settings: ${e.message}`);
    }

    /**
     * Updates browser privacy.network settings depending on blocking WebRTC or not
     */
    private async handleBlockWebRTC() {
        const webRTCDisabled = this.configuration!.blockWebRTC;

        if (typeof browser.privacy.network.webRTCIPHandlingPolicy === 'object') {
            try {
                if (webRTCDisabled) {
                    await browser.privacy.network.webRTCIPHandlingPolicy.set({
                        value: 'disable_non_proxied_udp',
                        scope: 'regular',
                    });
                } else {
                    await browser.privacy.network.webRTCIPHandlingPolicy.clear({
                        scope: 'regular',
                    });
                }
            } catch (e) {
                this.logError(e as Error);
            }
        }

        if (typeof browser.privacy.network.peerConnectionEnabled === 'object') {
            try {
                if (webRTCDisabled) {
                    browser.privacy.network.peerConnectionEnabled.set({
                        value: false,
                        scope: 'regular',
                    });
                } else {
                    browser.privacy.network.peerConnectionEnabled.clear({
                        scope: 'regular',
                    });
                }
            } catch (e) {
                this.logError(e as Error);
            }
        }
    }
}

export const stealthApi = new StealthApi(mockFilteringLog);
