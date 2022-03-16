/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-unused-vars */
import merge from 'deepmerge';
import {
    AppInterfaceMV3,
    SiteStatus,
    defaultFilteringLog,
    configurationValidatorMV3,
    ConfigurationMV3,
} from '../../common';

// TODO: implement
export class TsWebExtensionMv3 implements AppInterfaceMV3 {
    public isStarted = false;

    public configuration: ConfigurationMV3 | undefined;

    public onFilteringLogEvent = defaultFilteringLog.onLogEvent;

    /**
     * Web accessible resources path in the result bundle
     */
    private readonly webAccessibleResourcesPath: string | undefined;

    /**
     * Constructor
     *
     * @param webAccessibleResourcesPath optional
     */
    constructor(webAccessibleResourcesPath?: string) {
        this.webAccessibleResourcesPath = webAccessibleResourcesPath;
    }

    public async start(configuration: ConfigurationMV3): Promise<void> {
        configurationValidatorMV3.parse(configuration);

        this.isStarted = true;
        this.configure(configuration);
    }

    // TODO: Move to separate module
    private async updateFiltering(
        enableFiltersIds: number[],
        disableFiltersIds: number[],
    ): Promise<void> {
        chrome.declarativeNetRequest.updateEnabledRulesets({
            enableRulesetIds: enableFiltersIds
                .map((filterId) => {
                    return `ruleset_${filterId}`;
                }),
            disableRulesetIds: disableFiltersIds
                .map((filterId) => {
                    return `ruleset_${filterId}`;
                }),
        });
    }

    public async stop(): Promise<void> {
        this.isStarted = false;
    }

    /* TODO: merge update */
    public async configure(configuration: ConfigurationMV3): Promise<void> {
        configurationValidatorMV3.parse(configuration);

        if (!this.isStarted) {
            throw new Error('App is not started!');
        }

        const enableFiltersIds = configuration.filters;
        const disableFiltersIds = this.configuration
            ? this.configuration.filters
                .filter((f) => !enableFiltersIds.includes(f))
            : [];

        this.configuration = merge({}, configuration);
        this.updateFiltering(enableFiltersIds, disableFiltersIds);
    }

    public openAssistant(tabId: number): void {}

    public closeAssistant(tabId: number): void {}

    public getSiteStatus(url: string): SiteStatus {
        return SiteStatus.FilteringEnabled;
    }

    public getRulesCount(): number {
        return 0;
    }
}
