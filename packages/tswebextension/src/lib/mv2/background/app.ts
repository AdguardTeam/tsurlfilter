/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { WebRequestApi } from './web-request-api';
import { engineApi } from './engine-api';
import { tabsApi } from './tabs';
import { resourcesService } from './services/resources-service';
import { redirectsService } from './services/redirects-service';
import { FrameRequestService } from './services/frame-request-service';
import { messagesApi } from './messages-api';
import { stealthApi } from './stealth-api';
import {
    AppInterfaceMV2,
    SiteStatus,
    defaultFilteringLog,
    MessageType,
    configurationValidatorMV2,
    ConfigurationMV2,
} from '../../common';

export interface ManifestV2AppInterface extends AppInterfaceMV2 {
    getMessageHandler: () => typeof messagesApi.handleMessage
}

export class TsWebExtension implements ManifestV2AppInterface {
    public isStarted = false;

    public configuration: ConfigurationMV2 | undefined;

    public onFilteringLogEvent = defaultFilteringLog.onLogEvent;

    /**
     * Constructor
     *
     * @param webAccessibleResourcesPath
     */
    constructor(webAccessibleResourcesPath: string) {
        resourcesService.init(webAccessibleResourcesPath);
    }

    public async start(configuration: ConfigurationMV2): Promise<void> {
        configurationValidatorMV2.parse(configuration);

        await redirectsService.start();
        await tabsApi.start();
        FrameRequestService.start();
        await engineApi.startEngine(configuration);
        await stealthApi.start(configuration);
        WebRequestApi.start();

        this.isStarted = true;
        this.configuration = configuration;
    }

    public async stop(): Promise<void> {
        WebRequestApi.stop();
        FrameRequestService.stop();
        tabsApi.stop();
        stealthApi.stop();
        this.isStarted = false;
    }

    /* TODO: merge update */
    public async configure(configuration: ConfigurationMV2): Promise<void> {
        configurationValidatorMV2.parse(configuration);

        if (!this.isStarted) {
            throw new Error('App is not started!');
        }

        await engineApi.startEngine(configuration);
        this.configuration = configuration;

        /* TODO: this.stop */
        stealthApi.stop();
        await stealthApi.start(configuration);
    }

    public openAssistant(tabId: number): void {
        messagesApi.addAssistantCreateRuleListener(this.addUserRule.bind(this));

        messagesApi.sendMessage(tabId, {
            type: MessageType.INIT_ASSISTANT,
        });
    }

    public closeAssistant(tabId: number): void {
        messagesApi.sendMessage(tabId, {
            type: MessageType.CLOSE_ASSISTANT,
        });
    }

    public getSiteStatus(url: string): SiteStatus {
        return SiteStatus.FilteringEnabled;
    }

    public getRulesCount(): number {
        return engineApi.getRulesCount();
    }

    public getMessageHandler() {
        return messagesApi.handleMessage;
    }

    /**
     * Adds ruleText to user rules
     *
     * @param ruleText
     */
    private addUserRule(ruleText: string): void {
        if (!this.configuration || !this.isStarted) {
            return;
        }

        this.configuration.userrules.push(ruleText);
        this.configure(this.configuration);
    }
}
