import browser from 'webextension-polyfill';
import { StringRuleList, logger } from '@adguard/tsurlfilter';
import { StealthService } from './services/stealth-service';
import { RequestContext } from './request';

import {
    Configuration,
    FilteringLogInterface,
    defaultFilteringLog,
    StealthConfig,
} from '../../common';

/**
 * Stealth api
 */
export interface StealthApiInterface {
    configure: (configuration: Configuration) => Promise<void>;
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
    private filteringLog: FilteringLogInterface;

    private isStealthModeEnabled: boolean | undefined;

    private isFilteringEnabled: boolean | undefined;

    constructor(filteringLog: FilteringLogInterface) {
        this.filteringLog = filteringLog;
    }

    public async configure(configuration: Configuration): Promise<void> {
        const { settings } = configuration;

        const { stealth, stealthModeEnabled, filteringEnabled } = settings;

        this.isStealthModeEnabled = stealthModeEnabled;
        this.isFilteringEnabled = filteringEnabled;
        this.configuration = stealth;
        this.engine = new StealthService(this.configuration, this.filteringLog);

        // TODO: Privacy permission for block webrtc stealth setting
        if (StealthApi.canBlockWebRTC()) {
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
     * Returns rule list with stealth mode rules
     * @return {StringRuleList}
     */
    public getStealthModeRuleList(): StringRuleList | null {
        if (!this.engine
            || !this.isStealthModeEnabled
            || !this.isFilteringEnabled
        ) {
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
    public onBeforeSendHeaders(context: RequestContext):void {
        if (!this.engine) {
            return;
        }

        if (!context) {
            return;
        }

        if (!this.canApplyStealthActionsToContext(context)) {
            return;
        }

        this.engine.processRequestHeaders(context);
    }

    private canApplyStealthActionsToContext(context: RequestContext): boolean {
        if (!this.isStealthModeEnabled || !this.isFilteringEnabled) {
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
     * Updates browser privacy.network settings depending on blocking WebRTC or not
     */
    private async handleBlockWebRTC() {
        if (!this.configuration) {
            return;
        }

        const webRTCDisabled = this.configuration.blockWebRTC;

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
                StealthApi.logError(e as Error);
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
                StealthApi.logError(e as Error);
            }
        }
    }

    private static canBlockWebRTC() {
        // Edge doesn't support privacy api
        // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/privacy
        return !!browser.privacy;
    }

    private static logError(e: Error) {
        logger.error(`Error updating privacy.network settings: ${e.message}`);
    }
}

export const stealthApi = new StealthApi(defaultFilteringLog);
