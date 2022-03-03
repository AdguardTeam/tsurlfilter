/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
    AppInterface,
    SiteStatus,
    defaultFilteringLog,
    configurationValidator,
    Configuration,
} from '../../common';

// TODO: implement
export class TsWebExtensionMv3 implements AppInterface {
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
        this.configuration = configuration;
    }

    public async stop(): Promise<void> {
        this.isStarted = false;
    }

    /* TODO: merge update */
    public async configure(configuration: Configuration): Promise<void> {
        configurationValidator.parse(configuration);

        if (!this.isStarted) {
            throw new Error('App is not started!');
        }

        this.configuration = configuration;
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
