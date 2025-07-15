import { RequestType } from '@adguard/tsurlfilter/es/request-type';
import { NetworkRuleOption, StealthOptionName, type NetworkRule } from '@adguard/tsurlfilter';
import { type WebRequest } from 'webextension-polyfill';

import { type StealthConfig } from '../../../common/configuration';
import { defaultFilteringLog, FilteringEventType } from '../../../common/filtering-log';
import { StealthActions } from '../../../common/stealth-actions';
import { findHeaderByName, hasHeader, hasHeaderByName } from '../../../common/utils/headers';
import { logger } from '../../../common/utils/logger';
import { getDomain } from '../../../common/utils/url';
import { appContext } from '../app-context';
import { type SettingsConfigMV3 } from '../configuration';
import { requestContextStorage, type RequestContext } from '../request';
import { SessionRulesApi } from '../session-rules-api';

import { searchEngineDomains } from './searchEngineDomains';

/**
 * Reserved stealth rule ids for the DNR.
 */
export enum StealthRuleId {
    HideReferrer = 1,
    BlockChromeClientData = 2,
    SendDoNotTrack = 3,
    HideSearchQueries = SessionRulesApi.MIN_DECLARATIVE_RULE_ID,
}

/**
 * Reserved stealth content script ids.
 */
enum StealthContentScriptId {
    Gpc = 'gpc',
    DocumentReferrer = 'documentReferrer',
}

/**
 * Extracted stealth setting from {@link SettingsConfigMV3} which can be used
 * in MV3 and which will be returned as a result of the configuration, because
 * during the configuration settings can because during the installation of the
 * DNR rules, something may go wrong and the rule is not created - in this case,
 * we will return the current configuration status unchanged.
 */
export type StealthConfigurationResult = Pick<
    StealthConfig,
    'hideReferrer' | 'blockWebRTC' | 'blockChromeClientData' | 'sendDoNotTrack' | 'hideSearchQueries'
>;

/**
 * Stealth service module.
 */
export class StealthService {
    /**
     * Required permissions for the stealth options related to browser settings.
     */
    private static readonly REQUIRED_PERMISSIONS: chrome.runtime.ManifestPermissions[] = ['privacy'];

    /**
     * Scope of the applied browser setting related to the stealth options.
     * Regular scope means that the setting is applied to the both incognito and regular windows.
     */
    private static readonly SETTING_SCOPE = 'regular';

    /**
     * Stealth headers.
     */
    private static readonly HEADERS: Record<string, WebRequest.HttpHeadersItemType> = {
        REFERRER: {
            name: 'Referer',
        },
        X_CLIENT_DATA: {
            name: 'X-Client-Data',
        },
        DO_NOT_TRACK: {
            name: 'DNT',
            value: '1',
        },
        GLOBAL_PRIVACY_CONTROL: {
            name: 'Sec-GPC',
            value: '1',
        },
    };

    /**
     * Types of resources to apply the stealth declarative network rules.
     *
     * @returns Array of resource types.
     */
    private static get RESOURCE_TYPES(): chrome.declarativeNetRequest.ResourceType[] {
        return [
            chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
            chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
            chrome.declarativeNetRequest.ResourceType.STYLESHEET,
            chrome.declarativeNetRequest.ResourceType.SCRIPT,
            chrome.declarativeNetRequest.ResourceType.IMAGE,
            chrome.declarativeNetRequest.ResourceType.FONT,
            chrome.declarativeNetRequest.ResourceType.OBJECT,
            chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
            chrome.declarativeNetRequest.ResourceType.PING,
            chrome.declarativeNetRequest.ResourceType.CSP_REPORT,
            chrome.declarativeNetRequest.ResourceType.MEDIA,
            chrome.declarativeNetRequest.ResourceType.WEBSOCKET,
            chrome.declarativeNetRequest.ResourceType.OTHER,
        ];
    }

    /**
     * Temporary flag that used to identify is stealth allowlist implemented or not.
     * It's used to identify should we check for allowlist rule in order
     * to publish `StealthAllowlistAction` event.
     *
     * TODO: After adding stealth allowlist we should remove it.
     */
    private static readonly IS_ALLOWLIST_IMPLEMENTED = false;

    /**
     * Temporary flag that used to identify is stealth `Hide Referrer`
     * and `Hide Search Queries` checkboxes is presented or not.
     *
     * TODO: After reverting that checkboxes we should remove it (AG-34765).
     */
    private static readonly IS_REFERRER_CHECKBOX_PRESENT = false;

    /**
     * Applies stealth actions to request headers and publishes filtering log event.
     *
     * @param context Request context.
     */
    public static onBeforeSendHeaders(context: RequestContext): void {
        const settings = appContext.configuration?.settings;

        if (!settings || !settings.stealthModeEnabled) {
            return;
        }

        let stealthActions = StealthActions.None;

        const {
            requestUrl,
            requestHeaders,
            matchingResult,
            requestType,
            tabId,
            eventId,
            referrerUrl,
            contentType,
            timestamp,
            requestId,
        } = context;

        if (!requestHeaders || matchingResult?.documentRule) {
            return;
        }

        /**
         * Regarding stealth rule modifier, stealth options can be disabled on two occasions:
         * - stealth modifier does not have specific values, thus disabling stealth entirely
         * - stealth modifier has specific options to disable.
         */
        const stealthDisablingRule = matchingResult?.getStealthRule();
        if (StealthService.IS_ALLOWLIST_IMPLEMENTED && stealthDisablingRule) {
            // $stealth rule without options is not being published to the filtering log
            // to conform with desktop application behavior
            return;
        }

        const {
            hideReferrer,
            hideSearchQueries,
            blockChromeClientData,
            sendDoNotTrack,
        } = settings.stealth;

        const headersToRemove = new Set<string>();
        const headersToAdd: WebRequest.HttpHeaders = [];

        // Collect applied allowlist rules in a set to only publish
        // one filtering event per applied allowlist rule
        const appliedAllowlistRules = new Set<NetworkRule>();

        // Removes `Referrer` header if present
        if (StealthService.IS_REFERRER_CHECKBOX_PRESENT && hideReferrer) {
            const disablingRule = matchingResult?.getStealthRule(StealthOptionName.HideReferrer);
            if (StealthService.IS_ALLOWLIST_IMPLEMENTED && disablingRule) {
                appliedAllowlistRules.add(disablingRule);
            } else if (hasHeaderByName(requestHeaders, StealthService.HEADERS.REFERRER.name)) {
                stealthActions |= StealthActions.HideReferrer;
                headersToRemove.add(
                    StealthService.HEADERS.REFERRER.name.toLowerCase(),
                );
            }
        }

        // Removes `Referrer` header in case of search engine is referrer
        const isMainFrame = requestType === RequestType.Document;
        if (StealthService.IS_REFERRER_CHECKBOX_PRESENT && isMainFrame && hideSearchQueries) {
            const disablingRule = matchingResult?.getStealthRule(StealthOptionName.HideSearchQueries);
            if (StealthService.IS_ALLOWLIST_IMPLEMENTED && disablingRule) {
                appliedAllowlistRules.add(disablingRule);
            } else if (
                hasHeaderByName(requestHeaders, StealthService.HEADERS.REFERRER.name)
                && StealthService.isSearchEngine(requestUrl)
            ) {
                stealthActions |= StealthActions.HideSearchQueries;
                headersToRemove.add(
                    StealthService.HEADERS.REFERRER.name.toLowerCase(),
                );
            }
        }

        // Removes `X-Client-Data` header if present
        if (blockChromeClientData) {
            const disablingRule = matchingResult?.getStealthRule(StealthOptionName.XClientData);
            if (StealthService.IS_ALLOWLIST_IMPLEMENTED && disablingRule) {
                appliedAllowlistRules.add(disablingRule);
            } else if (hasHeaderByName(requestHeaders, StealthService.HEADERS.X_CLIENT_DATA.name)) {
                stealthActions |= StealthActions.BlockChromeClientData;
                headersToRemove.add(
                    StealthService.HEADERS.X_CLIENT_DATA.name.toLowerCase(),
                );
            }
        }

        // Adds `Do-Not-Track (DNT)` and `Global-Privacy-Control (Sec-GPC)` headers if not present
        if (sendDoNotTrack) {
            const disablingRule = matchingResult?.getStealthRule(StealthOptionName.DoNotTrack);
            if (StealthService.IS_ALLOWLIST_IMPLEMENTED && disablingRule) {
                appliedAllowlistRules.add(disablingRule);
            } else {
                let headerAdded = false;

                if (!hasHeader(requestHeaders, StealthService.HEADERS.DO_NOT_TRACK)) {
                    headersToAdd.push(StealthService.HEADERS.DO_NOT_TRACK);
                    headerAdded = true;
                }

                if (!hasHeader(requestHeaders, StealthService.HEADERS.GLOBAL_PRIVACY_CONTROL)) {
                    headersToAdd.push(StealthService.HEADERS.GLOBAL_PRIVACY_CONTROL);
                    headerAdded = true;
                }

                if (headerAdded) {
                    stealthActions |= StealthActions.SendDoNotTrack;
                }
            }
        }

        // Removing headers
        let newRequestHeaders = requestHeaders;
        if (headersToRemove.size > 0) {
            newRequestHeaders = requestHeaders.filter((header) => {
                return !headersToRemove.has(header.name.toLowerCase());
            });
        }

        // Adding headers
        for (const header of headersToAdd) {
            const foundHeader = findHeaderByName(newRequestHeaders, header.name);
            if (foundHeader) {
                foundHeader.value = header.value;
            } else {
                newRequestHeaders.push(header);
            }
        }

        requestContextStorage.update(requestId, {
            requestHeaders: newRequestHeaders,
        });

        if (appliedAllowlistRules.size > 0) {
            defaultFilteringLog.publishEvent({
                type: FilteringEventType.StealthAllowlistAction,
                data: {
                    tabId,
                    eventId,
                    rules: Array.from(appliedAllowlistRules).map((rule) => ({
                        filterId: rule.getFilterListId(),
                        ruleIndex: rule.getIndex(),
                        isAllowlist: rule.isAllowlist(),
                        isImportant: rule.isOptionEnabled(NetworkRuleOption.Important),
                        isDocumentLevel: rule.isDocumentLevelAllowlistRule(),
                        isCsp: rule.isOptionEnabled(NetworkRuleOption.Csp),
                        isCookie: rule.isOptionEnabled(NetworkRuleOption.Cookie),
                        advancedModifier: rule.getAdvancedModifierValue(),
                    })),
                    requestUrl,
                    frameUrl: referrerUrl,
                    requestType: contentType,
                    timestamp,
                },
            });
        }

        if (stealthActions > 0) {
            defaultFilteringLog.publishEvent({
                type: FilteringEventType.StealthAction,
                data: {
                    tabId,
                    eventId,
                    stealthActions,
                },
            });
        }
    }

    /**
     * Applies the stealth options from the settings configuration.
     *
     * @param settingsConfig Settings configuration.
     *
     * @returns Partial stealth configuration with boolean status of applied
     * changes.
     */
    public static async applySettings(settingsConfig: SettingsConfigMV3): Promise<StealthConfigurationResult> {
        const {
            stealthModeEnabled,
            stealth,
            gpcScriptUrl,
            hideDocumentReferrerScriptUrl,
        } = settingsConfig;

        // "Syntax sugar" to fit into 120 max characters per line.
        const enabled = stealthModeEnabled;

        const [
            hideReferrer,
            blockWebRTC,
            blockChromeClientData,
            sendDoNotTrack,
            hideSearchQueries,
        ] = await Promise.all([
            StealthService.setHideReferrer(enabled && stealth.hideReferrer),
            StealthService.setDisableWebRTC(enabled && stealth.blockWebRTC),
            StealthService.setBlockChromeClientData(enabled && stealth.blockChromeClientData),
            StealthService.setSendDoNotTrack(enabled && stealth.sendDoNotTrack, gpcScriptUrl),
            StealthService.setHideSearchQueries(enabled && stealth.hideSearchQueries, hideDocumentReferrerScriptUrl),
        ]);

        return {
            hideReferrer,
            blockWebRTC,
            blockChromeClientData,
            sendDoNotTrack,
            hideSearchQueries,
        };
    }

    /**
     * Set the referrer header to be hidden.
     *
     * @param isReferrerHidden Flag that determines if the referrer should be hidden.
     *
     * @returns Promise that resolves with current state of the referrer header.
     */
    public static async setHideReferrer(isReferrerHidden: boolean): Promise<boolean> {
        if (!isReferrerHidden) {
            try {
                await StealthService.removeSessionRule(StealthRuleId.HideReferrer);

                return isReferrerHidden;
            } catch (e) {
                logger.error('[tsweb.StealthService.setHideReferrer]: error on removing the stealth rule "hide-referrer": ', e);

                return !isReferrerHidden;
            }
        }

        try {
            await StealthService.setSessionRule({
                id: StealthRuleId.HideReferrer,
                action: {
                    type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
                    requestHeaders: [{
                        header: StealthService.HEADERS.REFERRER.name,
                        operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
                    }],
                },
                condition: {
                    urlFilter: '*',
                    resourceTypes: StealthService.RESOURCE_TYPES,
                },
            });

            return isReferrerHidden;
        } catch (e) {
            logger.error('[tsweb.StealthService.setHideReferrer]: error on setting the stealth rule $referrer: ', e);

            return !isReferrerHidden;
        }
    }

    /**
     * If {@link isBlockChromeClientData} is true, add the declarative network rule to remove
     * `X-Client-Data` header from every request.
     *
     * @param isBlockChromeClientData Flag that determines if the `X-Client-Data` header is removed.
     *
     * @returns Promise that resolves with current state of the referrer header.
     */
    public static async setBlockChromeClientData(isBlockChromeClientData: boolean): Promise<boolean> {
        if (!isBlockChromeClientData) {
            try {
                await StealthService.removeSessionRule(StealthRuleId.BlockChromeClientData);

                return isBlockChromeClientData;
            } catch (e) {
                logger.error('[tsweb.StealthService.setBlockChromeClientData]: error on removing the stealth rule $xclientdata: ', e);

                return !isBlockChromeClientData;
            }
        }

        try {
            await StealthService.setSessionRule({
                id: StealthRuleId.BlockChromeClientData,
                action: {
                    type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
                    requestHeaders: [{
                        header: StealthService.HEADERS.X_CLIENT_DATA.name,
                        operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
                    }],
                },
                condition: {
                    urlFilter: '*',
                    resourceTypes: StealthService.RESOURCE_TYPES,
                },
            });

            return isBlockChromeClientData;
        } catch (e) {
            logger.error('[tsweb.StealthService.setBlockChromeClientData]: error on setting the stealth rule $xclientdata: ', e);

            return !isBlockChromeClientData;
        }
    }

    /**
     * If {@link isSendDoNotTrack} is true, add the declarative network rule to set `DNT`
     * and `Sec-GPC` headers for every request.
     *
     * @param isSendDoNotTrack Flag that determines if the `Do Not Track` and `Global Privacy Control` signals is set.
     * @param gpcScriptUrl Path to content script for injecting GPC signal.
     *
     * @returns Promise that resolves with current state of the referrer header.
     */
    public static async setSendDoNotTrack(
        isSendDoNotTrack: boolean,
        gpcScriptUrl: string,
    ): Promise<boolean> {
        if (!isSendDoNotTrack) {
            try {
                await Promise.all([
                    StealthService.removeSessionRule(StealthRuleId.SendDoNotTrack),
                    StealthService.removeContentScript(StealthContentScriptId.Gpc),
                ]);

                return isSendDoNotTrack;
            } catch (e) {
                logger.error('[tsweb.StealthService.setSendDoNotTrack]: error on removing the stealth rule $donottrack: ', e);

                return !isSendDoNotTrack;
            }
        }

        try {
            await Promise.all([
                StealthService.setSessionRule({
                    id: StealthRuleId.SendDoNotTrack,
                    action: {
                        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
                        requestHeaders: [{
                            header: StealthService.HEADERS.DO_NOT_TRACK.name,
                            value: StealthService.HEADERS.DO_NOT_TRACK.value,
                            operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                        }, {
                            header: StealthService.HEADERS.GLOBAL_PRIVACY_CONTROL.name,
                            value: StealthService.HEADERS.GLOBAL_PRIVACY_CONTROL.value,
                            operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                        }],
                    },
                    condition: {
                        urlFilter: '*',
                        resourceTypes: StealthService.RESOURCE_TYPES,
                    },
                }),
                StealthService.setContentScript({
                    id: StealthContentScriptId.Gpc,
                    js: [gpcScriptUrl],
                    world: 'MAIN',
                    runAt: 'document_start',
                    matches: [
                        'http://*/*',
                        'https://*/*',
                    ],
                    persistAcrossSessions: false,
                }),
            ]);

            return isSendDoNotTrack;
        } catch (e) {
            logger.error('[tsweb.StealthService.setSendDoNotTrack]: error on setting the stealth rule $donottrack: ', e);

            return !isSendDoNotTrack;
        }
    }

    /**
     * If {@link isHideSearchQueries} is true, adds the declarative network rule to set the
     * `Referrer-Policy` header to `no-referrer` for the search pages like Google, Bing, etc.
     *
     * @param isHideSearchQueries Flag that determines if the search queries should be hidden.
     * @param hideDocumentReferrerScriptUrl Path to content script for hiding the document referrer.
     *
     * @returns Promise that resolves with current state of the referrer header.
     */
    public static async setHideSearchQueries(
        isHideSearchQueries: boolean,
        hideDocumentReferrerScriptUrl: string,
    ): Promise<boolean> {
        if (!isHideSearchQueries) {
            try {
                await Promise.all([
                    StealthService.removeSessionRule(StealthRuleId.HideSearchQueries),
                    StealthService.removeContentScript(StealthContentScriptId.DocumentReferrer),
                ]);

                return isHideSearchQueries;
            } catch (e) {
                logger.error('[tsweb.StealthService.setHideSearchQueries]: error on removing the stealth rule $searchqueries: ', e);

                return !isHideSearchQueries;
            }
        }

        try {
            await Promise.all([
                StealthService.setSessionRule({
                    id: StealthRuleId.HideSearchQueries,
                    action: {
                        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
                        requestHeaders: [{
                            header: StealthService.HEADERS.REFERRER.name,
                            operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
                        }],
                    },
                    condition: {
                        urlFilter: '*',
                        resourceTypes: StealthService.RESOURCE_TYPES,
                        initiatorDomains: searchEngineDomains,
                    },
                }),
                StealthService.setContentScript({
                    id: StealthContentScriptId.DocumentReferrer,
                    js: [hideDocumentReferrerScriptUrl],
                    world: 'MAIN',
                    runAt: 'document_start',
                    matches: [
                        'http://*/*',
                        'https://*/*',
                    ],
                    persistAcrossSessions: false,
                }),
            ]);

            return isHideSearchQueries;
        } catch (e) {
            logger.error('[tsweb.StealthService.setHideSearchQueries]: error on setting the stealth rule $searchqueries: ', e);

            return !isHideSearchQueries;
        }
    }

    /**
     * If {@link isWebRTCDisabled} is true, sets the browser IP policy to `disable_non_proxied_udp`,
     * otherwise restore default policy.
     *
     * @param isWebRTCDisabled Flag that determines if the WebRTC should be disabled.
     *
     * @returns Promise that resolves with current state of the referrer header.
     *
     * @throws Error if the permissions are not granted, but required to set the WebRTC policy.
     */
    public static async setDisableWebRTC(isWebRTCDisabled: boolean): Promise<boolean> {
        const permissions = StealthService.REQUIRED_PERMISSIONS;

        const isPermissionGranted = await chrome.permissions.contains({ permissions });

        if (!isPermissionGranted) {
            // If the option is disabled, do nothing.
            if (!isWebRTCDisabled) {
                return isWebRTCDisabled;
            }

            logger.error('[tsweb.StealthService.setDisableWebRTC]: permissions are not granted: ', permissions.join(', '));

            return !isWebRTCDisabled;
        }

        try {
            const setting = chrome.privacy.network.webRTCIPHandlingPolicy;

            if (isWebRTCDisabled) {
                await StealthService.setSetting(
                    setting,
                    chrome.privacy.IPHandlingPolicy.DISABLE_NON_PROXIED_UDP,
                );
            } else {
                await StealthService.clearSetting(setting);
            }

            return isWebRTCDisabled;
        } catch (e) {
            logger.error('[tsweb.StealthService.setDisableWebRTC]: error on setting the WebRTC policy ($webrtc): ', e);

            /**
             * Edge case: If error occurred while applying WebRTC
             * setting, it means that other extension might be
             * blocking it, we should return false as a indicator
             * of that WebRTC can not be enabled.
             */
            return false;
        }
    }

    /**
     * Sets the browser settings value.
     *
     * @param setting Webextension setting API.
     * @param value Setting value to set.
     *
     * @returns Resolves when the setting is set.
     *
     * @throws Error if the setting is not controllable or controlled by other extensions.
     */
    private static async setSetting<T>(
        setting: chrome.types.ChromeSetting<T>,
        value: T,
    ): Promise<void> {
        await StealthService.validateLevelOfControl(setting);

        return setting.set({ value, scope: StealthService.SETTING_SCOPE });
    }

    /**
     * Gets the browser settings value and webextension level of control.
     *
     * @param setting Webextension browser setting API.
     *
     * @returns Resolved promise with the setting value and level of control.
     *
     * @throws Error if something went wrong.
     */
    private static async getSetting<T>(
        setting: chrome.types.ChromeSetting<T>,
    ): Promise<chrome.types.ChromeSettingGetResult<T>> {
        // TODO: Check, should we use ChromeSettingGetDetails.incognito flag?
        return setting.get({});
    }

    /**
     * Sets the browser settings value to the default.
     *
     * @param setting Webextension browser setting API.
     *
     * @returns Resolved promise when the setting is cleared.
     *
     * @throws Error if something went wrong.
     */
    private static async clearSetting<T>(
        setting: chrome.types.ChromeSetting<T>,
    ): Promise<void> {
        await StealthService.validateLevelOfControl(setting);

        return setting.clear({ scope: StealthService.SETTING_SCOPE });
    }

    /**
     * Checks if the setting is controllable.
     *
     * @param setting Webextension browser setting API.
     *
     * @throws Error, if setting is not controllable.
     */
    private static async validateLevelOfControl<T>(
        setting: chrome.types.ChromeSetting<T>,
    ): Promise<void> {
        const { levelOfControl } = await StealthService.getSetting(setting);

        if (levelOfControl === 'not_controllable') {
            throw new Error('Setting is not controllable');
        }

        if (levelOfControl === 'controlled_by_other_extensions') {
            throw new Error('Setting is controlled by other extensions');
        }
    }

    /**
     * Set the stealth rule in the session ruleset.
     * If the rule with the same id already exists, it will be replaced.
     *
     * @param rule Stealth rule to set.
     *
     * @returns Resolved promise when the rule is set.
     */
    private static async setSessionRule(
        rule: chrome.declarativeNetRequest.Rule & { id: StealthRuleId },
    ): Promise<void> {
        return SessionRulesApi.setStealthRule(rule);
    }

    /**
     * Remove the stealth rule from the session ruleset.
     *
     * @param ruleId Stealth rule id.
     *
     * @returns Resolved promise when the rule is removed.
     */
    private static async removeSessionRule(ruleId: StealthRuleId): Promise<void> {
        return SessionRulesApi.removeStealthRule(ruleId);
    }

    /**
     * Unregister content script with specified {@link contentScriptId}.
     * If content script is not found, do nothing.
     *
     * @param contentScriptId Content script id.
     */
    private static async removeContentScript(contentScriptId: StealthContentScriptId): Promise<void> {
        const existedContentScripts = await chrome.scripting.getRegisteredContentScripts({
            ids: [contentScriptId],
        });

        if (existedContentScripts.length > 0) {
            await chrome.scripting.unregisterContentScripts({
                ids: existedContentScripts.map(((script) => script.id)),
            });
        }
    }

    /**
     * Register content script.
     * If content script with {@link contentScript} has already registered, update it.
     *
     * @param contentScript Content script to set.
     */
    private static async setContentScript(
        contentScript: chrome.scripting.RegisteredContentScript & { id: StealthContentScriptId },
    ): Promise<void> {
        await StealthService.removeContentScript(contentScript.id);

        await chrome.scripting.registerContentScripts([contentScript]);
    }

    /**
     * Removes all stealth rules and content scripts.
     */
    public static async clearAll(): Promise<void> {
        const ruleIds = Object.keys(StealthRuleId)
            .map((key) => Number(key))
            .filter((keyNumber) => !Number.isNaN(keyNumber));
        await SessionRulesApi.removeStealthRules(ruleIds);

        const contentScriptIds = Object.values(StealthContentScriptId);
        contentScriptIds.forEach(async (id) => {
            await StealthService.removeContentScript(id);
        });
    }

    /**
     * Is url search engine.
     *
     * @param url Url for check.
     *
     * @returns True if url is search engine.
     */
    private static isSearchEngine(url: string): boolean {
        const domain = getDomain(url);
        return searchEngineDomains.some((searchEngine) => searchEngine === domain);
    }
}
