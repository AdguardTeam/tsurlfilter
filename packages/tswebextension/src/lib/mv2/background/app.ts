/* eslint-disable class-methods-use-this */
import { sessionStorage } from './session-storage';
import { appContext } from './context';
import { WebRequestApi } from './web-request-api';
import {
    tabsApi,
    engineApi,
    documentApi,
} from './api';
import { resourcesService } from './services/resources-service';
import { redirectsService } from './services/redirects/redirects-service';
import { documentBlockingService } from './services/document-blocking-service';

import { messagesApi, type MessageHandlerMV2 } from './messages-api';
import {
    type AppInterface,
    defaultFilteringLog,
} from '../../common';

import {
    ConfigurationMV2,
    ConfigurationMV2Context,
    configurationMV2Validator,
} from './configuration';
import { Assistant } from './assistant';
import { LocalScriptRules, localScriptRulesService } from './services/local-script-rules-service';
import { RequestEvents } from './request';
import { TabsCosmeticInjector } from './tabs/tabs-cosmetic-injector';
import { stealthApi } from './stealth-api';

/**
 * App implementation for MV2.
 */
export class TsWebExtension implements AppInterface<
ConfigurationMV2,
ConfigurationMV2Context,
void,
MessageHandlerMV2
> {
    /**
     * Fires on filtering log event.
     */
    public onFilteringLogEvent = defaultFilteringLog.onLogEvent;

    /**
     * Fires when a rule has been created from the helper.
     */
    public onAssistantCreateRule = Assistant.onCreateRule;

    /**
     * Gets app running status.
     *
     * @returns True if app started, else false.
     */
    public get isStarted(): boolean {
        // TODO: Remove this check after moving call of storage initialization in extension code.
        // Check this flag before access storage values, because engine methods
        // can be triggered before initialization by extension `onCheckRequestFilterReady` method.
        if (!appContext.isStorageInitialized) {
            return false;
        }

        return appContext.isAppStarted;
    }

    /**
     * Sets app running status.
     *
     * @param value Status value.
     */
    public set isStarted(value: boolean) {
        appContext.isAppStarted = value;
    }

    /**
     * Gets app configuration context.
     *
     * @throws Error if value not set.
     * @returns True if app started, else false.
     */
    public get configuration(): ConfigurationMV2Context {
        if (!appContext.configuration) {
            throw new Error('Configuration not set!');
        }

        return appContext.configuration;
    }

    /**
     * Sets app configuration context.
     *
     * @param value Status value.
     */
    public set configuration(value: ConfigurationMV2Context) {
        appContext.configuration = value;
    }

    /**
     * Tabs cosmetic injector.
     * Used to inject cosmetic rules into opened tabs on extension start.
     */
    private readonly tabCosmeticInjector = new TabsCosmeticInjector(
        engineApi,
        documentApi,
        tabsApi,
    );

    /**
     * Constructor.
     *
     * @param webAccessibleResourcesPath Path to web accessible resources for {@link resourcesService}.
     */
    constructor(webAccessibleResourcesPath: string) {
        resourcesService.init(webAccessibleResourcesPath);
    }

    /**
     * Initializes {@link EngineApi} with passed {@link configuration}.
     * Starts request processing via {@link WebRequestApi} and tab tracking via {@link tabsApi}.
     *
     * Also updates webRTC privacy.network settings on demand and flushes browser in-memory request cache.
     *
     * @param configuration App configuration.
     *
     * @throws Error if configuration is not valid.
     */
    public async start(configuration: ConfigurationMV2): Promise<void> {
        await sessionStorage.init();
        appContext.isStorageInitialized = true;

        configurationMV2Validator.parse(configuration);

        this.configuration = TsWebExtension.createConfigurationMV2Context(configuration);

        RequestEvents.init();
        await redirectsService.start();
        documentBlockingService.configure(configuration);
        await engineApi.startEngine(configuration);
        await this.tabCosmeticInjector.processOpenTabs();
        await tabsApi.start();
        WebRequestApi.start();
        Assistant.assistantUrl = configuration.settings.assistantUrl;

        await WebRequestApi.flushMemoryCache();
        await stealthApi.updateWebRtcPrivacyPermissions();

        this.isStarted = true;
    }

    /**
     * Fully stop request and tab processing.
     */
    public async stop(): Promise<void> {
        WebRequestApi.stop();
        tabsApi.stop();
        this.isStarted = false;
    }

    /**
     * Re-initializes {@link EngineApi} with passed {@link configuration}
     * and update tabs main frame rules based on new engine state.
     *
     * Also updates webRTC privacy.network settings on demand and flushes browser in-memory request cache.
     *
     * Requires app is started.
     *
     * @param configuration App configuration.
     *
     * @throws Error if app is not started or configuration is not valid.
     */
    public async configure(configuration: ConfigurationMV2): Promise<void> {
        if (!this.isStarted) {
            throw new Error('App is not started!');
        }

        configurationMV2Validator.parse(configuration);

        this.configuration = TsWebExtension.createConfigurationMV2Context(configuration);

        documentBlockingService.configure(configuration);
        await engineApi.startEngine(configuration);
        await tabsApi.updateCurrentTabsMainFrameRules();

        await WebRequestApi.flushMemoryCache();
        await stealthApi.updateWebRtcPrivacyPermissions();
    }

    /**
     * Opens assistant in the tab.
     *
     * @param tabId Tab id where assistant will be opened.
     */
    public async openAssistant(tabId: number): Promise<void> {
        await Assistant.openAssistant(tabId);
    }

    /**
     * Close assistant in the required tab.
     *
     * @param tabId Tab id.
     */
    public async closeAssistant(tabId: number): Promise<void> {
        await Assistant.closeAssistant(tabId);
    }

    /**
     * Return rules count for current configuration.
     *
     * @returns Rules count.
     */
    public getRulesCount(): number {
        return engineApi.getRulesCount();
    }

    /**
     * Returns a message handler that will listen to internal messages,
     * for example: message for get computed css for content-script.
     *
     * @returns Messages handler.
     */
    public getMessageHandler(): MessageHandlerMV2 {
        return messagesApi.handleMessage;
    }

    /**
     * Sets prebuild local script rules.
     *
     * @see {@link LocalScriptRulesService}
     *
     * @param localScriptRules JSON object with pre-build JS rules. @see {@link LocalScriptRulesService}.
     */
    public setLocalScriptRules(localScriptRules: LocalScriptRules): void {
        localScriptRulesService.setLocalScriptRules(localScriptRules);
    }

    /**
     * Updates `filteringEnabled` configuration value without re-initialization of engine.
     *
     * Also updates webRTC privacy.network settings on demand and flushes browser in-memory request cache.
     *
     * @throws Error if {@link configuration} not set.
     * @param isFilteringEnabled `filteringEnabled` config value.
     */
    public async setFilteringEnabled(isFilteringEnabled: boolean): Promise<void> {
        this.configuration.settings.filteringEnabled = isFilteringEnabled;

        await WebRequestApi.flushMemoryCache();
        await stealthApi.updateWebRtcPrivacyPermissions();
    }

    /**
     * Updates `collectStats` configuration value without re-initialization of engine.
     *
     * @throws Error if {@link configuration} not set.
     * @param isCollectStats `collectStats` config value.
     */
    public setCollectHitStats(isCollectStats: boolean): void {
        this.configuration.settings.collectStats = isCollectStats;
    }

    /**
     * Updates `stealthModeEnabled` configuration value without re-initialization of engine.
     * Also updates webRTC privacy.network settings on demand.
     *
     * @throws Error if {@link configuration} not set.
     * @param isStealthModeEnabled `stealthModeEnabled` config value.
     */
    public async setStealthModeEnabled(isStealthModeEnabled: boolean): Promise<void> {
        this.configuration.settings.stealthModeEnabled = isStealthModeEnabled;

        await stealthApi.updateWebRtcPrivacyPermissions();
    }

    /**
     * Updates `selfDestructFirstPartyCookies` stealth config value without re-initialization of engine.
     *
     * @throws Error if {@link configuration} not set.
     * @param isSelfDestructFirstPartyCookies `selfDestructFirstPartyCookies` stealth config value.
     */
    public setSelfDestructFirstPartyCookies(isSelfDestructFirstPartyCookies: boolean): void {
        this.configuration.settings.stealth.selfDestructFirstPartyCookies = isSelfDestructFirstPartyCookies;
    }

    /**
     * Updates `selfDestructThirdPartyCookies` stealth config value without re-initialization of engine.
     *
     * @throws Error if {@link configuration} not set.
     * @param isSelfDestructThirdPartyCookies `selfDestructThirdPartyCookies` stealth config value.
     */
    public setSelfDestructThirdPartyCookies(isSelfDestructThirdPartyCookies: boolean): void {
        this.configuration.settings.stealth.selfDestructThirdPartyCookies = isSelfDestructThirdPartyCookies;
    }

    /**
     * Updates `selfDestructFirstPartyCookiesTime` stealth config value without re-initialization of engine.
     *
     * @throws Error if {@link configuration} not set.
     * @param selfDestructFirstPartyCookiesTime `selfDestructFirstPartyCookiesTime` stealth config value.
     */
    public setSelfDestructFirstPartyCookiesTime(selfDestructFirstPartyCookiesTime: number): void {
        this.configuration.settings.stealth.selfDestructFirstPartyCookiesTime = selfDestructFirstPartyCookiesTime;
    }

    /**
     * Updates `selfDestructThirdPartyCookiesTime` stealth config value without re-initialization of engine.
     *
     * @throws Error if {@link configuration} not set.
     * @param selfDestructThirdPartyCookiesTime `selfDestructThirdPartyCookiesTime` stealth config value.
     */
    public setSelfDestructThirdPartyCookiesTime(selfDestructThirdPartyCookiesTime: number): void {
        this.configuration.settings.stealth.selfDestructThirdPartyCookiesTime = selfDestructThirdPartyCookiesTime;
    }

    /**
     * Updates `hideReferrer` stealth config value without re-initialization of engine.
     *
     * @throws Error if {@link configuration} not set.
     * @param isHideReferrer `isHideReferrer` stealth config value.
     */
    public setHideReferrer(isHideReferrer: boolean): void {
        this.configuration.settings.stealth.hideReferrer = isHideReferrer;
    }

    /**
     * Updates `hideSearchQueries` stealth config value without re-initialization of engine.
     *
     * @throws Error if {@link configuration} not set.
     * @param isHideSearchQueries `hideSearchQueries` stealth config value.
     */
    public setHideSearchQueries(isHideSearchQueries: boolean): void {
        this.configuration.settings.stealth.hideSearchQueries = isHideSearchQueries;
    }

    /**
     * Updates `blockChromeClientData` stealth config value without re-initialization of engine.
     *
     * @throws Error if {@link configuration} not set.
     * @param isBlockChromeClientData `blockChromeClientData` stealth config value.
     */
    public setBlockChromeClientData(isBlockChromeClientData: boolean): void {
        this.configuration.settings.stealth.blockChromeClientData = isBlockChromeClientData;
    }

    /**
     * Updates `sendDoNotTrack` stealth config value without re-initialization of engine.
     *
     * @throws Error if {@link configuration} not set.
     * @param isSendDoNotTrack `sendDoNotTrack` stealth config value.
     */
    public setSendDoNotTrack(isSendDoNotTrack: boolean): void {
        this.configuration.settings.stealth.sendDoNotTrack = isSendDoNotTrack;
    }

    /**
     * Updates `blockWebRTC` stealth config value without re-initialization of engine.
     * Also updates webRTC privacy.network settings on demand.
     *
     * @throws Error if {@link configuration} not set.
     * @param isBlockWebRTC `blockWebRTC` stealth config value.
     */
    public async setBlockWebRTC(isBlockWebRTC: boolean): Promise<void> {
        this.configuration.settings.stealth.blockWebRTC = isBlockWebRTC;

        await stealthApi.updateWebRtcPrivacyPermissions();
    }

    /**
     * Creates configuration context.
     *
     * @param configuration Configuration.
     * @returns Configuration context.
     */
    private static createConfigurationMV2Context(configuration: ConfigurationMV2): ConfigurationMV2Context {
        const {
            filters,
            verbose,
            logLevel,
            settings,
        } = configuration;

        return {
            filters: filters.map(({ filterId }) => filterId),
            verbose,
            logLevel,
            settings,
        };
    }
}
