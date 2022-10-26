import browser, { Runtime } from "webextension-polyfill";
import {
    TsWebExtension,
    ConfigurationMV2 as TsWebExtensionConfiguration,
    EventChannel,
    FilteringLogEvent,
    MESSAGE_HANDLER_NAME,
    Message,
} from "@adguard/tswebextension";

import { Network } from "./network";
import { Storage } from "./storage";
import { FiltersApi, FiltersService } from "./filters";
import { Configuration, configurationValidator } from "./schemas";

export const WEB_ACCESSIBLE_RESOURCES_PATH = "adguard";

export class AdguardApi {
    private tswebextension: TsWebExtension;

    private network: Network;

    private filtersApi: FiltersApi;

    private filtersService: FiltersService;

    /**
     * {@link TsWebExtension} {@link EventChannel}, which fires event on assistant rule creation.
     */
    public onAssistantCreateRule: EventChannel<string>;

    /**
     * {@link TsWebExtension} {@link EventChannel} for filtering log events.
     *
     */
    public onFilteringLogEvent: EventChannel<FilteringLogEvent>;

    constructor() {
        this.tswebextension = new TsWebExtension(WEB_ACCESSIBLE_RESOURCES_PATH);

        this.onAssistantCreateRule = this.tswebextension.onAssistantCreateRule;
        this.onFilteringLogEvent = this.tswebextension.onFilteringLogEvent;

        this.network = new Network();

        const storage = new Storage();

        this.filtersApi = new FiltersApi(this.network, storage);

        this.filtersService = new FiltersService(this.filtersApi);

        this.handleMessage = this.handleMessage.bind(this);
    }

    /**
     * Initializes AdGuard with specified {@link Configuration} and starts it immediately.
     *
     * @param configuration - api {@link Configuration}
     * @returns applied {@link Configuration} promise
     */
    public async start(configuration: Configuration): Promise<Configuration> {
        configurationValidator.parse(configuration);

        this.network.configure(configuration);

        browser.runtime.onMessage.addListener(this.handleMessage);

        await this.filtersApi.init();
        this.filtersService.start();

        const tsWebExtensionConfiguration = await this.createTsWebExtensionConfiguration(configuration);

        await this.tswebextension.start(tsWebExtensionConfiguration);

        return configuration;
    }

    /**
     * Completely stops AdGuard
     */
    public async stop(): Promise<void> {
        await this.tswebextension.stop();
        this.filtersService.stop();

        browser.runtime.onMessage.removeListener(this.handleMessage);
    }

    /**
     * Modifies AdGuard {@link Configuration}. Please note, that Adguard must be already started.
     *
     * @param configuration - api {@link Configuration}
     * @returns applied {@link Configuration} promise
     */
    public async configure(configuration: Configuration): Promise<Configuration> {
        configurationValidator.parse(configuration);

        this.network.configure(configuration);

        const tsWebExtensionConfiguration = await this.createTsWebExtensionConfiguration(configuration);

        await this.tswebextension.configure(tsWebExtensionConfiguration);

        return configuration;
    }

    /**
     * Opens the AdGuard assistant UI in the specified tab.
     * You should also subscribe on {@link onAssistantCreateRule} event channel for applying rules,
     * which are created by the Adguard assistant.
     *
     * @param tabId - Tab id
     */
    public openAssistant(tabId: number): void {
        this.tswebextension.openAssistant(tabId);
    }

    /**
     * Closes AdGuard assistant in the specified tab.
     *
     * @param tabId  - Tab id
     */
    public closeAssistant(tabId: number): void {
        this.tswebextension.closeAssistant(tabId);
    }

    /**
     * Gets current loaded rules count
     *
     * @returns rules count number
     */
    public getRulesCount(): number {
        return this.tswebextension.getRulesCount();
    }

    private async createTsWebExtensionConfiguration(
        configuration: Configuration
    ): Promise<TsWebExtensionConfiguration> {
        let allowlistInverted = false;
        let allowlist: string[] = [];

        if (configuration.blacklist) {
            allowlist = configuration.blacklist;
            allowlistInverted = true;
        } else if (configuration.whitelist) {
            allowlist = configuration.whitelist;
        }

        const userrules = configuration.rules || [];

        const filters = await this.filtersApi.getFilters(configuration.filters);

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

    private async handleMessage(message: Message, sender: Runtime.MessageSender) {
        if (message?.handlerName === MESSAGE_HANDLER_NAME) {
            const handler = this.tswebextension.getMessageHandler();

            return handler(message, sender);
        }

        return undefined;
    }
}
