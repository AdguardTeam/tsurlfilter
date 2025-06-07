import browser from 'webextension-polyfill';
import {
    type IRuleList,
    BufferRuleList,
    STEALTH_MODE_FILTER_ID,
    StealthOptionName,
    type NetworkRule,
    type MatchingResult,
    FilterListPreprocessor,
} from '@adguard/tsurlfilter';

import { type StealthConfig } from '../../common/configuration';
import { defaultFilteringLog, type FilteringLogInterface } from '../../common/filtering-log';
import { StealthActions } from '../../common/stealth-actions';
import { logger } from '../../common/utils/logger';

import { appContext, type AppContext } from './app-context';
import { type RequestContext } from './request';
import { StealthService } from './services/stealth-service';

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
     * Stealth service.
     */
    private readonly stealthService: StealthService;

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
     * Checks if both stealth mode and filtering are enabled.
     *
     * @returns True if stealth mode and filtering are enabled.
     */
    private get isStealthAllowed():boolean {
        return this.isStealthModeEnabled && this.isFilteringEnabled;
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
        this.stealthService = new StealthService(this.appContext, this.filteringLog);
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
            logger.error('[tsweb.StealthApi.updateWebRtcPrivacyPermissions]: error updating privacy.network settings: ', e);
        }
    }

    /**
     * Returns rule list with stealth mode rules.
     *
     * @returns String rule list or null.
     */
    public getStealthModeRuleList(): IRuleList | null {
        if (!this.isStealthAllowed) {
            return null;
        }

        // TODO (David): Change to AST generation
        const rulesTexts = this.stealthService.getCookieRulesTexts().join('\n');

        return new BufferRuleList(
            STEALTH_MODE_FILTER_ID,
            FilterListPreprocessor.preprocess(rulesTexts).filterList,
            false,
            false,
        );
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

        if (!this.isStealthAllowed) {
            return false;
        }

        const stealthActions = this.stealthService.processRequestHeaders(context);

        return stealthActions !== StealthActions.None;
    }

    /**
     * Returns stealth script to apply to the frame.
     *
     * TODO this should be expanded for v2.3 to accommodate for $stealth values feature,
     * i.e checking specific stealth options (dnt and referrer)
     * https://github.com/AdguardTeam/tsurlfilter/issues/100.
     *
     * @param mainFrameRule Main frame rule to use if no matching result provided.
     * @param matchingResult Matching result.
     *
     * @returns Stealth script.
     */
    public getStealthScript(mainFrameRule: NetworkRule | null, matchingResult?: MatchingResult | null): string {
        if (!this.isStealthAllowed) {
            return '';
        }

        let documentRule: NetworkRule | null = null;
        // Matching result may be missing in case of dynamically created frames without url
        if (matchingResult) {
            documentRule = matchingResult.documentRule || matchingResult.getStealthRule();
        } else {
            documentRule = mainFrameRule;
        }

        if (documentRule) {
            return '';
        }

        let stealthScript = '';
        if (!matchingResult?.getStealthRule(StealthOptionName.DoNotTrack)) {
            stealthScript += this.getSetDomSignalScript();
        }

        if (!matchingResult?.getStealthRule(StealthOptionName.HideReferrer)) {
            stealthScript += this.getHideDocumentReferrerScript();
        }

        return stealthScript;
    }

    /**
     * Returns set dom signal script if sendDoNotTrack enabled, otherwise empty string.
     *
     * @returns Dom signal script.
     */
    public getSetDomSignalScript(): string {
        return this.isStealthAllowed
            ? this.stealthService.getSetDomSignalScript()
            : '';
    }

    /**
     * Returns hide document referrer script if hideDocumentReferrer enabled, otherwise empty string.
     *
     * @returns Hide referrer script.
     */
    public getHideDocumentReferrerScript(): string {
        return this.isStealthAllowed
            ? this.stealthService.getHideDocumentReferrerScript()
            : '';
    }

    /**
     * Updates browser privacy.network settings depending on blocking WebRTC or not.
     */
    private async handleBlockWebRTC(): Promise<void> {
        if (!this.configuration) {
            return;
        }

        const isWebRTCDisabled = this.configuration.blockWebRTC && this.isStealthAllowed;

        try {
            if (isWebRTCDisabled) {
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
            logger.error('[tsweb.StealthApi.handleBlockWebRTC]: error updating privacy.network settings: ', e);
        }

        // privacy.network.peerConnectionEnabled is currently only supported in Firefox
        if (typeof browser.privacy.network.peerConnectionEnabled === 'object') {
            try {
                if (isWebRTCDisabled) {
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
                logger.error('[tsweb.StealthApi.handleBlockWebRTC]: error updating privacy.network settings: ', e);
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
