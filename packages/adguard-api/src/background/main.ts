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
import { FiltersApi, FiltersUpdateService, LocaleDetectService } from "./filters";
import { Configuration, configurationValidator } from "./schemas";
import { DetectFiltersEvent, notifier, NotifierEventType } from "./notifier";

export const WEB_ACCESSIBLE_RESOURCES_PATH = "adguard";

export class AdguardApi {
    private tswebextension: TsWebExtension;

    private network: Network;

    private filtersApi: FiltersApi;

    private filtersUpdateService: FiltersUpdateService;

    private localeDetectService: LocaleDetectService;

    private configuration: Configuration | undefined;

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
     * @param tabId - Tab id
     */
    public async openAssistant(tabId: number): Promise<void> {
        await this.tswebextension.openAssistant(tabId);
    }

    /**
     * Closes AdGuard assistant in the specified tab.
     *
     * @param tabId  - Tab id
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

    private async createTsWebExtensionConfiguration(): Promise<TsWebExtensionConfiguration> {
        if (!this.configuration) {
            throw new Error("Api configuration is not set");
        }

        let allowlistInverted = false;
        let allowlist: string[] = [];

        if (this.configuration.blacklist) {
            allowlist = this.configuration.blacklist;
            allowlistInverted = true;
        } else if (this.configuration.whitelist) {
            allowlist = this.configuration.whitelist;
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

    // eslint-disable-next-line consistent-return
    private async handleMessage(message: Message, sender: Runtime.MessageSender) {
        if (message?.handlerName === MESSAGE_HANDLER_NAME) {
            const handler = this.tswebextension.getMessageHandler();

            return handler(message, sender);
        }
    }

    private async handleUpdateFilters() {
        const tsWebExtensionConfig = await this.createTsWebExtensionConfiguration();

        await this.tswebextension.configure(tsWebExtensionConfig);

        // eslint-disable-next-line no-console
        console.log("Reload engine with updated filter ids list");
    }

    private async handleDetectFilters(event: DetectFiltersEvent) {
        if (!this.configuration) {
            throw new Error("Api configuration is not set");
        }

        const { filters: currentFilters } = this.configuration;

        const filtersIds = event.data.filtersIds.filter((id) => !currentFilters.includes(id));

        if (filtersIds.length === 0) {
            return;
        }

        this.configuration.filters = [...this.configuration.filters, ...filtersIds];

        // eslint-disable-next-line no-console
        console.log(`Add language filters ids: ${filtersIds}`);

        await this.handleUpdateFilters();
    }
}

export const adguardApi = new AdguardApi();
