/* eslint-disable class-methods-use-this */
import browser from 'webextension-polyfill';
import { StringRuleList } from '@adguard/tsurlfilter';

import { StealthActions, StealthService } from './services/stealth-service';
import { RequestContext } from './request';
import {
    Configuration,
    FilteringLogInterface,
    defaultFilteringLog,
    StealthConfig,
    logger,
} from '../../common';
import { appContext } from './context';

/**
 * Stealth api interface.
 */
export interface StealthApiInterface {
    configure: (configuration: Configuration) => Promise<void>;
}

/**
 * Stealth api implementation.
 */
export class StealthApi implements StealthApiInterface {
    /**
     * Privacy permission for block webrtc stealth setting.
     */
    private static PRIVACY_PERMISSIONS = {
        permissions: ['privacy'],
    };

    /**
     * Stealth filter identifier.
     */
    private static STEALTH_MODE_FILTER_ID: -1;

    /**
     * Stealth configuration.
     */
    private configuration: StealthConfig | undefined;

    /**
     * Stealth service.
     */
    private engine: StealthService | undefined;

    /**
     * Filtering log.
     */
    private filteringLog: FilteringLogInterface;

    private isStealthModeEnabled: boolean | undefined;

    /**
     * Gets app filtering status.
     *
     * @returns True if filtering is enabled, otherwise returns false.
     */
    private get isFilteringEnabled(): boolean {
        return Boolean(appContext.configuration?.settings.filteringEnabled);
    }

    /**
     * Stealth API constructor.
     *
     * @param filteringLog Filtering log.
     */
    constructor(filteringLog: FilteringLogInterface) {
        this.filteringLog = filteringLog;
    }

    /**
     * Configure stealth api.
     *
     * @param configuration Configuration.
     */
    public async configure(configuration: Configuration): Promise<void> {
        const { settings } = configuration;

        const {
            stealth,
            stealthModeEnabled,
        } = settings;

        this.isStealthModeEnabled = stealthModeEnabled;
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
     * Returns rule list with stealth mode rules.
     *
     * @returns String rule list or null.
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
     * Stealth api onBeforeRequest handler.
     *
     * @param context Request context.
     *
     * @returns True if the headers have been changed.
     */
    public onBeforeSendHeaders(context: RequestContext): boolean {
        if (!this.engine) {
            return false;
        }

        if (!context) {
            return false;
        }

        if (!this.canApplyStealthActionsToContext(context)) {
            return false;
        }

        const stealthActions = this.engine.processRequestHeaders(context);

        return stealthActions !== StealthActions.NONE;
    }

    /**
     * Checks if stealth actions can be applied to request context.
     *
     * @param context Request context.
     * @returns True if stealth actions can be applied to request context.
     */
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
     * Returns set dom signal script if sendDoNotTrack enabled, otherwise empty string.
     *
     * @returns Dom signal script.
     */
    public getSetDomSignalScript(): string {
        return this.engine?.getSetDomSignalScript() || '';
    }

    /**
     * Updates browser privacy.network settings depending on blocking WebRTC or not.
     */
    private async handleBlockWebRTC(): Promise<void> {
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
                logger.error(`Error updating privacy.network settings: ${(e as Error).message}`);
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
                logger.error(`Error updating privacy.network settings: ${(e as Error).message}`);
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

export const stealthApi = new StealthApi(defaultFilteringLog);
