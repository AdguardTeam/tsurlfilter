/**
 * @file
 * This file is part of Adguard API library (https://github.com/AdguardTeam/tsurlfilter/packages/adguard-api).
 *
 * Adguard API is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Adguard API is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adguard API. If not, see <http://www.gnu.org/licenses/>.
 */

import browser, { Runtime } from "webextension-polyfill";
import {
    TsWebExtension,
    ConfigurationMV2 as TsWebExtensionConfiguration,
    EventChannel,
    MESSAGE_HANDLER_NAME,
    Message,
} from "@adguard/tswebextension";

import { Network } from "./network";
import { Storage } from "./storage";
import { FiltersApi, FiltersUpdateService, LocaleDetectService } from "./filters";
import { Configuration, configurationValidator } from "./schemas";
import { DetectFiltersEvent, notifier, NotifierEventType } from "./notifier";
import { RequestBlockingLogger } from "./request-blocking-logger";
import { Logger } from "./logger";

/**
 * By the rules of Firefox AMO we cannot use remote scripts (and our JS rules can be counted as such).
 * Because of that we use the following approach (that was accepted by AMO reviewers):
 *
 * 1. We pre-build JS rules from AdGuard filters into the JSON file.
 * 2. At runtime we check every JS rule if it's included into JSON.
 *  If it is included we allow this rule to work since it's pre-built. Other rules are discarded.
 * 3. We also allow "User rules" to work since those rules are added manually by the user.
 *  This way filters maintainers can test new rules before including them in the filters.
 */
import localScriptRules from "../local_script_rules.json";

export const WEB_ACCESSIBLE_RESOURCES_PATH = "adguard";

/**
 * AdGuard API is filtering library, provided following features:
 * - request and content filtering, using {@link TsWebExtension}
 * - filters rules downloading and caching via {@link FiltersApi}
 * - filters rules auto updates via {@link filtersUpdateService}
 * - content blocking via AdGuard Assistant UI, provided by {@link TsWebExtension}
 * - auto detecting language filters via {@link localeDetectService}
 * - logging request processing via filtering events api, provided by {@link TsWebExtension}
 */
export class AdguardApi {
    // Engine instance
    private tswebextension: TsWebExtension;

    // Network requests API
    private network: Network;

    // API for managing filters data
    private filtersApi: FiltersApi;

    // Service for scheduling filters rules updates
    private filtersUpdateService: FiltersUpdateService;

    // Service for auto-enabling language-specific filters.
    private localeDetectService: LocaleDetectService;

    // AdguardApi configuration
    private configuration: Configuration | undefined;

    // Simple Api for logging
    private logger: Logger;

    /**
     * {@link TsWebExtension} {@link EventChannel}, which fires event on assistant rule creation.
     */
    public onAssistantCreateRule: EventChannel<string>;

    /**
     * API for adding and removing listeners for request blocking events.
     *
     */
    public onRequestBlocked = new RequestBlockingLogger();

    constructor() {
        this.tswebextension = new TsWebExtension(WEB_ACCESSIBLE_RESOURCES_PATH);

        // TODO: load only in ff
        this.tswebextension.setLocalScriptRules(localScriptRules);

        this.onAssistantCreateRule = this.tswebextension.onAssistantCreateRule;

        this.network = new Network();

        const storage = new Storage();

        this.logger = new Logger();

        this.filtersApi = new FiltersApi(this.network, storage, this.logger);

        this.filtersUpdateService = new FiltersUpdateService(this.filtersApi);

        this.localeDetectService = new LocaleDetectService(this.filtersApi);

        this.handleMessage = this.handleMessage.bind(this);
        this.openAssistant = this.openAssistant.bind(this);
        this.handleDetectFilters = this.handleDetectFilters.bind(this);
        this.handleUpdateFilters = this.handleUpdateFilters.bind(this);
    }

    /**
     * Initializes AdGuard with specified {@link Configuration} and starts it immediately.
     *
     * @param configuration - api {@link Configuration}
     * @returns applied {@link Configuration} promise
     */
    public async start(configuration: Configuration): Promise<Configuration> {
        this.configuration = configurationValidator.parse(configuration);

        this.network.configure(this.configuration);

        browser.runtime.onMessage.addListener(this.handleMessage);

        await this.filtersApi.init();
        this.filtersUpdateService.start();
        this.localeDetectService.start();

        notifier.addListener(NotifierEventType.UpdateFilters, this.handleUpdateFilters);
        notifier.addListener(NotifierEventType.DetectFilters, this.handleDetectFilters);

        const tsWebExtensionConfiguration = await this.createTsWebExtensionConfiguration();

        await this.tswebextension.start(tsWebExtensionConfiguration);

        return configuration;
    }

    /**
     * Completely stops AdGuard
     */
    public async stop(): Promise<void> {
        await this.tswebextension.stop();
        this.filtersUpdateService.stop();
        this.localeDetectService.stop();

        browser.runtime.onMessage.removeListener(this.handleMessage);
    }

    /**
     * Modifies AdGuard {@link Configuration}. Please note, that Adguard must be already started.
     *
     * @param configuration - api {@link Configuration}
     * @returns applied {@link Configuration} promise
     */
    public async configure(configuration: Configuration): Promise<Configuration> {
        this.configuration = configurationValidator.parse(configuration);

        this.network.configure(this.configuration);

        const tsWebExtensionConfiguration = await this.createTsWebExtensionConfiguration();

        await this.tswebextension.configure(tsWebExtensionConfiguration);

        return configuration;
    }

    /**
     * Opens the AdGuard assistant UI in the specified tab.
     * You should also subscribe on {@link onAssistantCreateRule} event channel for applying rules,
     * which are created by the Adguard assistant.
     *
     * @param tabId - {@link browser.tabs.Tab } id. @see https://developer.chrome.com/docs/extensions/reference/tabs/#type-Tab
     */
    public async openAssistant(tabId: number): Promise<void> {
        await this.tswebextension.openAssistant(tabId);
    }

    /**
     * Closes AdGuard assistant in the specified tab.
     *
     * @param tabId - {@link browser.tabs.Tab } id. @see https://developer.chrome.com/docs/extensions/reference/tabs/#type-Tab
     */
    public async closeAssistant(tabId: number): Promise<void> {
        await this.tswebextension.closeAssistant(tabId);
    }

    /**
     * Gets current loaded rules count
     *
     * @returns rules count number
     */
    public getRulesCount(): number {
        return this.tswebextension.getRulesCount();
    }

    /**
     * Creates {@link TsWebExtension} configuration based on current API {@link configuration}.
     *
     * @returns - {@link TsWebExtension} configuration
     */
    private async createTsWebExtensionConfiguration(): Promise<TsWebExtensionConfiguration> {
        if (!this.configuration) {
            throw new Error("Api configuration is not set");
        }

        let allowlistInverted = false;
        let allowlist: string[] = [];

        if (this.configuration.blocklist) {
            allowlist = this.configuration.blocklist;
            allowlistInverted = true;
        } else if (this.configuration.allowlist) {
            allowlist = this.configuration.allowlist;
        }

        const userrules = this.configuration.rules || [];

        const filters = await this.filtersApi.getFilters(this.configuration.filters);

        return {
            filters,
            allowlist,
            trustedDomains: [],
            userrules,
            verbose: false,
            settings: {
                filteringEnabled: true,
                stealthModeEnabled: true,
                collectStats: true,
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
     * Handles messages from {@link TsWebExtension} content-script
     *
     * @param message - {@link TsWebExtension} extension {@link Message}
     * @param sender - extension {@link Runtime.MessageSender}
     * @returns TsWebExtension message handler response
     */
    // eslint-disable-next-line consistent-return
    private async handleMessage(message: Message, sender: Runtime.MessageSender): Promise<unknown> {
        if (message?.handlerName === MESSAGE_HANDLER_NAME) {
            const handler = this.tswebextension.getMessageHandler();

            return handler(message, sender);
        }
    }

    /**
     * Handles fired {@link UpdateFiltersEvent}
     */
    private async handleUpdateFilters(): Promise<void> {
        const tsWebExtensionConfig = await this.createTsWebExtensionConfiguration();

        await this.tswebextension.configure(tsWebExtensionConfig);

        this.logger.info("Reload engine with updated filter ids list");
    }

    /**
     * Handles fired {@link DetectFiltersEvent}
     *
     * @param event - fired {@link DetectFiltersEvent}
     */
    private async handleDetectFilters(event: DetectFiltersEvent): Promise<void> {
        if (!this.configuration) {
            throw new Error("Api configuration is not set");
        }

        const { filters: currentFilters } = this.configuration;

        const filtersIds = event.data.filtersIds.filter((id) => !currentFilters.includes(id));

        if (filtersIds.length === 0) {
            return;
        }

        this.configuration.filters = [...this.configuration.filters, ...filtersIds];

        this.logger.info(`Add language filters ids: ${filtersIds}`);

        await this.handleUpdateFilters();
    }

    /**
     * Creates new adguardApi instance
     *
     * @returns AdguardApi instance
     */
    public static create(): AdguardApi {
        return new AdguardApi();
    }
}
