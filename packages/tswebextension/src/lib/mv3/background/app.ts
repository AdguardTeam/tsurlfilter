/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-unused-vars */
import merge from 'deepmerge';

import FiltersApi from './filters-api';
import UserRulesAPI from './user-rules-api';

import {
    configurationValidator,
    Configuration,
} from '../common';

import {
    AppInterface,
    SiteStatus,
    defaultFilteringLog,
} from '../../common';

// TODO: implement
export class TsWebExtensionMv3 implements AppInterface<Configuration> {
    public isStarted = false;

    public configuration: Configuration | undefined;

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

    public async start(configuration: Configuration): Promise<void> {
        configurationValidator.parse(configuration);

        this.isStarted = true;
        await this.configure(configuration);
    }

    public async stop(): Promise<void> {
        this.isStarted = false;

        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const existingRulesIds = existingRules.map((rule) => rule.id);

        await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existingRulesIds });

        await chrome.declarativeNetRequest.updateEnabledRulesets({
            disableRulesetIds: this.configuration?.filters
                .map((filterId) => {
                    return `ruleset_${filterId}`;
                }),
        });
    }

    /* TODO: merge update */
    public async configure(configuration: Configuration): Promise<void> {
        configurationValidator.parse(configuration);

        if (!this.isStarted) {
            throw new Error('App is not started!');
        }

        const enableFiltersIds = configuration.filters;
        const disableFiltersIds = this.configuration
            ? this.configuration.filters
                .filter((f) => !enableFiltersIds.includes(f))
            : [];

        this.configuration = merge({}, configuration);

        await FiltersApi.updateFiltering(enableFiltersIds, disableFiltersIds);
        await UserRulesAPI.updateDynamicFiltering(this.configuration.userrules);
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
