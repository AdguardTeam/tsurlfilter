import type { SettingsConfigMV3 } from '../configuration';
import { searchEngineDomains } from './searchEngineDomains';
import { logger } from '../../../common/utils/logger';

/**
 * Reserved stealth rule ids for the DNR.
 */
enum StealthRuleId {
    HideReferrer = 1,
    BlockChromeClientData,
    SendDoNotTrack,
    HideSearchQueries,
}

/**
 * Reserved stealth content script ids.
 */
enum StealthContentScriptId {
    Gpc = 'gpc',
    DocumentReferrer = 'documentReferrer',
}

/**
 * Stealth service module.
 */
export class StealthService {
    /**
     * Required permissions for the stealth options related to browser settings.
     */
    private static readonly REQUIRED_PERMISSIONS = ['privacy'];

    /**
     * Scope of the applied browser setting related to the stealth options.
     * Regular scope means that the setting is applied to the both incognito and regular windows.
     */
    private static readonly SETTING_SCOPE = 'regular';

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
     * Applies the stealth options from the settings configuration.
     * @param settingsConfig Settings configuration.
     */
    public static async applySettings(settingsConfig: SettingsConfigMV3): Promise<void> {
        const {
            stealthModeEnabled,
            stealth,
            gpcScriptUrl,
            hideDocumentReferrerScriptUrl,
        } = settingsConfig;

        const result = await Promise.allSettled([
            StealthService.setHideReferrer(stealthModeEnabled && stealth.hideReferrer),
            StealthService.setDisableWebRTC(stealthModeEnabled && stealth.blockWebRTC),
            StealthService.setBlockChromeClientData(stealthModeEnabled && stealth.blockChromeClientData),
            StealthService.setSendDoNotTrack(
                stealthModeEnabled && stealth.sendDoNotTrack,
                gpcScriptUrl,
            ),
            StealthService.setHideSearchQueries(
                stealthModeEnabled && stealth.hideSearchQueries,
                hideDocumentReferrerScriptUrl,
            ),
        ]);

        // FIXME: dispatch event/message to display error in extension UI
        // or update ConfigurationResult record in `app.ts`
        result.forEach((promise) => {
            if (promise.status === 'rejected') {
                logger.error('[tswebextension.applySettings]: error on applying stealth settings: ', promise.reason);
            }
        });
    }

    /**
     * Set the referrer header to be hidden.
     *
     * @param isReferrerHidden Flag that determines if the referrer should be hidden.
     * @returns Promise that resolves when the referrer setting is set.
     */
    public static async setHideReferrer(isReferrerHidden: boolean): Promise<void> {
        if (!isReferrerHidden) {
            return StealthService.removeSessionRule(StealthRuleId.HideReferrer);
        }

        return StealthService.setSessionRule({
            id: StealthRuleId.HideReferrer,
            action: {
                type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
                requestHeaders: [{
                    header: 'Referer',
                    operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
                }],
            },
            condition: {
                urlFilter: '*',
                resourceTypes: StealthService.RESOURCE_TYPES,
            },
        });
    }

    /**
     * If {@link isBlockChromeClientData} is true, add the declarative network rule to remove
     * `X-Client-Data` header from every request.
     *
     * @param isBlockChromeClientData Flag that determines if the `X-Client-Data` header is removed.
     * @returns Promise that resolves when the rule is set or removed.
     */
    public static async setBlockChromeClientData(isBlockChromeClientData: boolean): Promise<void> {
        if (!isBlockChromeClientData) {
            return StealthService.removeSessionRule(StealthRuleId.BlockChromeClientData);
        }

        return StealthService.setSessionRule({
            id: StealthRuleId.BlockChromeClientData,
            action: {
                type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
                requestHeaders: [{
                    header: 'X-Client-Data',
                    operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
                }],
            },
            condition: {
                urlFilter: '*',
                resourceTypes: StealthService.RESOURCE_TYPES,
            },
        });
    }

    /**
     * If {@link isSendDoNotTrack} is true, add the declarative network rule to set `DNT`
     * and `Sec-GPC` headers for every request.
     *
     * @param isSendDoNotTrack Flag that determines if the `Do Not Track` and `Global Privacy Control` signals is set.
     * @param gpcScriptUrl Path to content script for injecting GPC signal.
     * @returns Promise that resolves when the rule is set or removed.
     */
    public static async setSendDoNotTrack(
        isSendDoNotTrack: boolean,
        gpcScriptUrl: string,
    ): Promise<void> {
        if (!isSendDoNotTrack) {
            await Promise.all([
                StealthService.removeSessionRule(StealthRuleId.SendDoNotTrack),
                StealthService.removeContentScript(StealthContentScriptId.Gpc),
            ]);
            return;
        }

        await Promise.all([
            StealthService.setSessionRule({
                id: StealthRuleId.SendDoNotTrack,
                action: {
                    type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
                    requestHeaders: [{
                        header: 'DNT',
                        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                        value: '1',
                    }, {
                        header: 'Sec-GPC',
                        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                        value: '1',
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
    }

    /**
     * If {@link isHideSearchQueries} is true, adds the declarative network rule to set the
     * `Referrer-Policy` header to `no-referrer` for the search pages like Google, Bing, etc.
     *
     * @param isHideSearchQueries Flag that determines if the search queries should be hidden.
     * @param hideDocumentReferrerScriptUrl Path to content script for hiding the document referrer.
     * @returns Promise that resolves when the rule is set or removed.
     */
    public static async setHideSearchQueries(
        isHideSearchQueries: boolean,
        hideDocumentReferrerScriptUrl: string,
    ): Promise<void> {
        if (!isHideSearchQueries) {
            await Promise.all([
                StealthService.removeSessionRule(StealthRuleId.HideSearchQueries),
                StealthService.removeContentScript(StealthContentScriptId.DocumentReferrer),
            ]);
            return;
        }

        await Promise.all([
            StealthService.setSessionRule({
                id: StealthRuleId.HideSearchQueries,
                action: {
                    type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
                    requestHeaders: [{
                        header: 'Referer',
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
    }

    /**
     * If {@link isWebRTCDisabled} is true, sets the browser IP policy to `disable_non_proxied_udp`,
     * otherwise restore default policy.
     *
     * @param isWebRTCDisabled Flag that determines if the WebRTC should be disabled.
     * @throws Error if the permissions are not granted, but required to set the WebRTC policy.
     * @returns Promise that resolves when the WebRTC policy is set or restored.
     */
    public static async setDisableWebRTC(isWebRTCDisabled: boolean): Promise<void> {
        const isPermissionGranted = await chrome.permissions.contains({
            permissions: StealthService.REQUIRED_PERMISSIONS,
        });

        if (!isPermissionGranted) {
            // If the option is disabled, do nothing.
            if (!isWebRTCDisabled) {
                return;
            }

            // Otherwise, throw an error.
            throw new Error(
                `Permissions are not granted: ${StealthService.REQUIRED_PERMISSIONS.join(', ')}`,
            );
        }

        const setting = chrome.privacy.network.webRTCIPHandlingPolicy;

        if (isWebRTCDisabled) {
            await StealthService.setSetting(setting, 'disable_non_proxied_udp');
        } else {
            await StealthService.clearSetting(setting);
        }
    }

    /**
     * Sets the browser settings value.
     *
     * @param setting Webextension setting API.
     * @param value Setting value to set.
     * @returns Resolves when the setting is set.
     * @throws Error if the setting is not controllable or controlled by other extensions.
     */
    private static async setSetting(
        setting: chrome.types.ChromeSetting,
        value: unknown,
    ): Promise<void> {
        await StealthService.validateLevelOfControl(setting);

        return new Promise((resolve, reject) => {
            setting.set({
                value,
                scope: StealthService.SETTING_SCOPE,
            }, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Gets the browser settings value and webextension level of control.
     * @param setting Webextension browser setting API.
     * @returns Resolved promise with the setting value and level of control.
     * @throws Error if something went wrong.
     */
    private static async getSetting(
        setting: chrome.types.ChromeSetting,
    ): Promise<chrome.types.ChromeSettingGetResultDetails> {
        return new Promise((resolve, reject) => {
            setting.get({}, (details) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(details);
                }
            });
        });
    }

    /**
     * Sets the browser settings value to the default.
     * @param setting Webextension browser setting API.
     * @returns Resolved promise when the setting is cleared.
     * @throws Error if something went wrong.
     */
    private static async clearSetting(
        setting: chrome.types.ChromeSetting,
    ): Promise<void> {
        await StealthService.validateLevelOfControl(setting);

        return new Promise((resolve, reject) => {
            setting.clear({
                scope: StealthService.SETTING_SCOPE,
            }, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Checks if the setting is controllable.
     *
     * @param setting Webextension browser setting API.
     * @throws Error, if setting is not controllable.
     */
    private static async validateLevelOfControl(
        setting: chrome.types.ChromeSetting,
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
     * @returns Resolved promise when the rule is set.
     */
    private static async setSessionRule(
        rule: chrome.declarativeNetRequest.Rule & { id: StealthRuleId },
    ): Promise<void> {
        return chrome.declarativeNetRequest.updateSessionRules({
            addRules: [rule],
            removeRuleIds: [rule.id],
        });
    }

    /**
     * Remove the stealth rule from the session ruleset.
     *
     * @param ruleId Stealth rule id.
     * @returns Resolved promise when the rule is removed.
     */
    private static async removeSessionRule(ruleId: StealthRuleId): Promise<void> {
        return chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: [ruleId],
        });
    }

    /**
     * Unregister content script with specified {@link contentScriptId}.
     * If content script is not found, do nothing.
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
        await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: ruleIds });

        const contentScriptIds = Object.values(StealthContentScriptId);
        contentScriptIds.forEach(async (id) => {
            await StealthService.removeContentScript(id);
        });
    }
}
