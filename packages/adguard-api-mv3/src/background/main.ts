/**
 * @file
 * This file is part of Adguard API MV3 library (https://github.com/AdguardTeam/tsurlfilter/packages/adguard-api-mv3).
 *
 * Adguard API MV3 is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Adguard API MV3 is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adguard API MV3. If not, see <http://www.gnu.org/licenses/>.
 */

import {
    TsWebExtension,
    type Configuration as TsWebExtensionConfiguration,
    type MessageHandler,
    LF,
    ConvertedFilterList,
} from '@adguard/tswebextension/mv3';
import { type Configuration, configurationValidator } from './configuration';
import { RequestBlockingLogger } from './request-blocking-logger';

/**
 * AdGuard API is filtering library, provided following features:
 * - request and content filtering, using {@link TsWebExtension}
 * - content blocking via AdGuard Assistant UI, provided by {@link TsWebExtension}.
 */
export class AdguardApi {
    private static readonly WEB_ACCESSIBLE_RESOURCES_PATH = '/web-accessible-resources/redirects';

    private static readonly DECLARATIVE_RULES_PATH = '/declarative';

    // AdguardApi configuration
    private configuration: Configuration | undefined;

    /**
     * {@link TsWebExtension} {@link EventChannel}, which fires event on assistant rule creation.
     */
    public onAssistantCreateRule: typeof this.tswebextension.onAssistantCreateRule;

    /**
     * API for adding and removing listeners for request blocking events.
     *
     */
    public onRequestBlocked: RequestBlockingLogger;

    /**
     * Creates new AdguardApi instance.
     * @param tswebextension Instance of {@link TsWebExtension}.
     */
    constructor(private readonly tswebextension: TsWebExtension) {
        this.onAssistantCreateRule = this.tswebextension.onAssistantCreateRule;
        this.onRequestBlocked = new RequestBlockingLogger();

        this.openAssistant = this.openAssistant.bind(this);
    }

    /**
     * Returns a message handler that will listen to internal messages,
     * for example, message for get computed css for content-script.
     * @returns Message handler.
     */
    public getMessageHandler(): MessageHandler {
        return this.tswebextension.getMessageHandler();
    }

    /**
     * Initializes AdGuard with specified {@link Configuration} and starts it immediately.
     *
     * @param configuration - Api {@link Configuration}.
     *
     * @returns Applied {@link Configuration} promise.
     */
    public async start(configuration: Configuration): Promise<Configuration> {
        this.configuration = configurationValidator.parse(configuration);

        const tsWebExtensionConfiguration = await this.createTsWebExtensionConfiguration();

        await this.tswebextension.start(tsWebExtensionConfiguration);

        return this.configuration;
    }

    /**
     * Completely stops AdGuard.
     */
    public async stop(): Promise<void> {
        await this.tswebextension.stop();
    }

    /**
     * Modifies AdGuard {@link Configuration}. Please note, that Adguard must be already started.
     *
     * @param configuration - Api {@link Configuration}.
     *
     * @returns Applied {@link Configuration} promise.
     */
    public async configure(configuration: Configuration): Promise<Configuration> {
        this.configuration = configurationValidator.parse(configuration);

        const tsWebExtensionConfiguration = await this.createTsWebExtensionConfiguration();

        await this.tswebextension.configure(tsWebExtensionConfiguration);

        return this.configuration;
    }

    /**
     * Opens the AdGuard assistant UI in the specified tab.
     * You should also subscribe on {@link onAssistantCreateRule} event channel for applying rules,
     * which are created by the Adguard assistant.
     *
     * @param tabId - {@link browser.tabs.Tab } id. @see https://developer.chrome.com/docs/extensions/reference/tabs/#type-Tab.
     */
    public async openAssistant(tabId: number): Promise<void> {
        await this.tswebextension.openAssistant(tabId);
    }

    /**
     * Closes AdGuard assistant in the specified tab.
     *
     * @param tabId - {@link browser.tabs.Tab } id. @see https://developer.chrome.com/docs/extensions/reference/tabs/#type-Tab.
     */
    public async closeAssistant(tabId: number): Promise<void> {
        await this.tswebextension.closeAssistant(tabId);
    }

    /**
     * Gets current loaded rules count.
     *
     * @returns Rules count number.
     */
    public getRulesCount(): number {
        return this.tswebextension.getRulesCount();
    }

    /**
     * Creates {@link TsWebExtension} configuration based on current API {@link configuration}.
     *
     * @returns - {@link TsWebExtension} configuration.
     */
    private async createTsWebExtensionConfiguration(): Promise<TsWebExtensionConfiguration> {
        if (!this.configuration) {
            throw new Error('Api configuration is not set');
        }

        let allowlistInverted = false;
        let allowlist: string[] = [];

        if (this.configuration.blocklist) {
            allowlist = this.configuration.blocklist;
            allowlistInverted = true;
        } else if (this.configuration.allowlist) {
            allowlist = this.configuration.allowlist;
        }

        let converted: ConvertedFilterList;

        if (this.configuration.rules) {
            converted = new ConvertedFilterList(this.configuration.rules.join(LF));
        } else {
            converted = ConvertedFilterList.createEmpty();
        }

        const userrules: TsWebExtensionConfiguration['userrules'] = {
            content: converted.getContent(),
            conversionData: converted.getConversionData(),
        };

        return {
            filtersPath: this.configuration.assetsPath,
            ruleSetsPath: `${this.configuration.assetsPath}${AdguardApi.DECLARATIVE_RULES_PATH}`,
            customFilters: [],
            trustedDomains: [],
            // This is needed only for filters developers.
            declarativeLogEnabled: false,
            staticFiltersIds: this.configuration.filters,
            allowlist,
            userrules,
            settings: {
                assistantUrl: 'adguard-assistant.js',
                // Related stealth option is disabled
                gpcScriptUrl: 'whatever',
                // Related stealth option is disabled
                hideDocumentReferrerScriptUrl: 'whatever',
                filteringEnabled: this.configuration.filteringEnabled,
                debugScriptlets: false,
                stealthModeEnabled: true,
                collectStats: false,
                allowlistInverted,
                allowlistEnabled: true,
                stealth: {
                    blockChromeClientData: false,
                    hideReferrer: false,
                    hideSearchQueries: false,
                    sendDoNotTrack: false,
                    blockWebRTC: false,
                    selfDestructThirdPartyCookies: true,
                    selfDestructThirdPartyCookiesTime: 3600,
                    selfDestructFirstPartyCookies: true,
                    selfDestructFirstPartyCookiesTime: 3600,
                },
            },
        };
    }

    /**
     * Creates new adguardApi instance.
     *
     * @returns AdguardApi instance.
     */
    public static async create(): Promise<AdguardApi> {
        const tswebextension = new TsWebExtension(AdguardApi.WEB_ACCESSIBLE_RESOURCES_PATH);
        await tswebextension.initStorage();
        return new AdguardApi(tswebextension);
    }
}
