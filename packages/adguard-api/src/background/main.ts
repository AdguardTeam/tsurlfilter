import { TsWebExtension, ConfigurationMV2, EventChannel, FilteringLogEvent } from "@adguard/tswebextension";

import { Network } from "./network";
import { Storage } from "./storage";
import { FiltersApi, FiltersService } from "./filters";

export type AdguardApiConfiguration = Omit<ConfigurationMV2, "filters"> & { filters: number[] };

export type AdguardApiOptions = {
    resourcesPath: string;
    filtersMetadataUrl: string;
    filterRulesUrl: string;
};

// TODO: api same to old
export class AdguardApi implements AdguardApi {
    public tswebextension: TsWebExtension;

    private filtersApi: FiltersApi;

    private filtersService: FiltersService;

    /**
     * {@link TsWebExtension} {@link EventChannel}, which fires event on assistant rule creation.
     */
    public onAssistantCreateRule: typeof this.tswebextension.onAssistantCreateRule;

    // TODO: adapter
    /**
     * {@link TsWebExtension} {@link EventChannel} for filtering log events.
     *
     */
    public onFilteringLogEvent: EventChannel<FilteringLogEvent>;

    /**
     * Get's {@link TsWebExtension} message handler
     *
     * NOTE: you need to register handler by yourself in `runtime.onMessage`
     *
     * Registering multiple event handlers for `runtime.onMessage`,
     * which returns values to the sender, can cause hard-to-detect bugs.
     *
     * Therefore, we return only the message handling function,
     * which can be built into the application as follows:
     *
     * ```
     * import { MESSAGE_HANDLER_NAME } from '@adguard/tswebextension';
     *
     * ...
     *
     * browser.runtime.onMessage.addListener((message, sender) => {
     *  if (message.handlerName === MESSAGE_HANDLER_NAME) {
     *      return tsWebExtensionMessageHandler(message, sender);
     *  }
     *
     *  if(message.handlerName === YOU_APP_NAME) {
     *      return appMessageHandler(message, sender);
     *   }
     * });
     * ```
     */
    public getMessageHandler: typeof this.tswebextension.getMessageHandler;

    constructor({ resourcesPath, filtersMetadataUrl, filterRulesUrl }: AdguardApiOptions) {
        this.tswebextension = new TsWebExtension(resourcesPath);

        this.onAssistantCreateRule = this.tswebextension.onAssistantCreateRule;
        this.onFilteringLogEvent = this.tswebextension.onFilteringLogEvent;
        this.getMessageHandler = this.tswebextension.getMessageHandler;

        const network = new Network(filtersMetadataUrl, filterRulesUrl);

        const storage = new Storage();

        this.filtersApi = new FiltersApi(network, storage);

        this.filtersService = new FiltersService(this.filtersApi);
    }

    /**
     * Initializes AdGuard and starts it immediately.
     *
     * @param configuration - tswebextension configuration
     * @returns applied tswebextension configuration promise
     */
    public async start(configuration: AdguardApiConfiguration): Promise<AdguardApiConfiguration> {
        await this.filtersApi.init();
        this.filtersService.start();

        const { filters, ...rest } = configuration;

        await this.tswebextension.start({
            filters: await this.filtersApi.getFilters(filters),
            ...rest,
        });

        return configuration;
    }

    /**
     * Completely stops AdGuard
     */
    public async stop(): Promise<void> {
        await this.tswebextension.stop();
        this.filtersService.stop();
    }

    /**
     * Modifies AdGuard configuration. Please note, that Adguard must be already started.
     *
     * @param configuration - tswebextension configuration
     * @returns applied tswebextension configuration promise
     */
    public async configure(configuration: AdguardApiConfiguration): Promise<AdguardApiConfiguration> {
        const { filters, ...rest } = configuration;

        await this.tswebextension.configure({
            filters: await this.filtersApi.getFilters(filters),
            ...rest,
        });

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
}
