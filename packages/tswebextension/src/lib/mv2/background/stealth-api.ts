import browser from 'webextension-polyfill';
import { StringRuleList } from '@adguard/tsurlfilter';

import { StealthActions, StealthService } from './services/stealth-service';
import { RequestContext } from './request';
import {
    FilteringLogInterface,
    defaultFilteringLog,
    StealthConfig,
    logger,
    getErrorMessage,
} from '../../common';
import { appContext, type AppContext } from './context';

/**
 * Stealth api implementation.
 */
export class StealthApi {
    /**
     * Privacy permission for block webrtc stealth setting.
     */
    private static readonly PRIVACY_PERMISSIONS = {
        permissions: ['privacy'],
    };

    /**
     * Stealth filter identifier.
     */
    private static readonly STEALTH_MODE_FILTER_ID = -1;

    /**
     * Stealth service.
     */
    private readonly engine: StealthService;

    /**
     * Filtering log.
     */
    private readonly filteringLog: FilteringLogInterface;

    /**
     * App context.
     */
    private readonly appContext: AppContext;

    /**
     * Stealth configuration.
     *
     * @returns App Stealth configuration or undefined.
     */
    private get configuration(): StealthConfig | undefined {
        return this.appContext.configuration?.settings.stealth;
    }

    /**
     * Gets app stealth mode status.
     *
     * @returns True if stealth mode is enabled, otherwise returns false.
     */
    private get isStealthModeEnabled(): boolean {
        return Boolean(this.appContext.configuration?.settings.stealthModeEnabled);
    }

    /**
     * Gets app filtering status.
     *
     * TODO: This method is duplicated in {@link EngineApi}. Consider moving it to {@link appContext}
     *  itself (DRY). But appContext supposed to be deleted (v.zhelvis).
     *
     * @returns True if filtering is enabled, otherwise returns false.
     */
    private get isFilteringEnabled(): boolean {
        return Boolean(this.appContext.configuration?.settings.filteringEnabled);
    }

    /**
     * Stealth API constructor.
     *
     * @param appContextInstance App context.
     * @param filteringLog Filtering log.
     */
    constructor(appContextInstance: AppContext, filteringLog: FilteringLogInterface) {
        this.appContext = appContextInstance;
        this.filteringLog = filteringLog;
        this.engine = new StealthService(this.appContext, this.filteringLog);
    }

    /**
     * Requires privacy permissions and updates browser privacy.network
     * settings depending on blocking WebRTC or not.
     */
    public async updateWebRtcPrivacyPermissions(): Promise<void> {
        if (!StealthApi.canBlockWebRTC()) {
            return;
        }

        try {
            const isPermissionsGranted = await browser.permissions.contains(StealthApi.PRIVACY_PERMISSIONS);

            if (isPermissionsGranted) {
                await this.handleBlockWebRTC();
            }
        } catch (e) {
            logger.error(getErrorMessage(e));
        }
    }

    /**
     * Returns rule list with stealth mode rules.
     *
     * @returns String rule list or null.
     */
    public getStealthModeRuleList(): StringRuleList | null {
        if (!this.engine || !this.isStealthModeEnabled) {
            return null;
        }

        const rulesTexts = this.engine.getCookieRulesTexts().join('\n');

        return new StringRuleList(StealthApi.STEALTH_MODE_FILTER_ID, rulesTexts, false, false);
    }

    /**
     * Stealth api onBeforeRequest handler.
     *
     * @param context Request context.
     *
     * @returns True if the headers have been changed.
     */
    public onBeforeSendHeaders(context: RequestContext): boolean {
        if (!context) {
            return false;
        }

        if (!this.canApplyStealthActionsToContext(context)) {
            return false;
        }

        const stealthActions = this.engine.processRequestHeaders(context);

        return stealthActions !== StealthActions.None;
    }

    /**
     * Checks if both stealth mode and filtering are enabled.
     *
     * @returns True if stealth mode and filtering are enabled.
     */
    private isStealthAllowed():boolean {
        return this.isStealthModeEnabled && this.isFilteringEnabled;
    }

    /**
     * Checks if stealth actions can be applied to request context.
     *
     * @param context Request context.
     * @returns True if stealth actions can be applied to request context.
     */
    private canApplyStealthActionsToContext(context: RequestContext): boolean {
        if (!this.isStealthAllowed()) {
            return false;
        }

        const { matchingResult } = context;
        if (matchingResult) {
            if (matchingResult.documentRule || matchingResult.stealthRule) {
                return false;
            }
        }

        return true;
    }

    /**
     * Returns set dom signal script if sendDoNotTrack enabled, otherwise empty string.
     *
     * @returns Dom signal script.
     */
    public getSetDomSignalScript(): string {
        return this.isStealthAllowed() ? this.engine.getSetDomSignalScript() : '';
    }

    /**
     * Returns hide document referrer script if hideDocumentReferrer enabled, otherwise empty string.
     *
     * @returns Hide referrer script.
     */
    public getHideDocumentReferrerScript(): string {
        return this.isStealthAllowed() ? this.engine.getHideDocumentReferrerScript() : '';
    }

    /**
     * Updates browser privacy.network settings depending on blocking WebRTC or not.
     */
    private async handleBlockWebRTC(): Promise<void> {
        if (!this.configuration) {
            return;
        }

        const webRTCDisabled = this.configuration.blockWebRTC
            && this.isStealthModeEnabled
            && this.isFilteringEnabled;

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
            logger.error(`Error updating privacy.network settings: ${getErrorMessage(e)}`);
        }

        // privacy.network.peerConnectionEnabled is currently only supported in Firefox
        if (typeof browser.privacy.network.peerConnectionEnabled === 'object') {
            try {
                if (webRTCDisabled) {
                    await browser.privacy.network.peerConnectionEnabled.set({
                        value: false,
                        scope: 'regular',
                    });
                } else {
                    await browser.privacy.network.peerConnectionEnabled.clear({
                        scope: 'regular',
                    });
                }
            } catch (e) {
                logger.error(`Error updating privacy.network settings: ${getErrorMessage(e)}`);
            }
        }
    }

    /**
     * // TODO consider deprecating this method as edge browser is built on chromium now.
     * Checks if there is browser.privacy permission is granted.
     *
     * @returns True if there is browser.privacy permission.
     */
    private static canBlockWebRTC(): boolean {
        // Edge doesn't support privacy api
        // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/privacy
        return !!browser.privacy;
    }
}

export const stealthApi = new StealthApi(appContext, defaultFilteringLog);
