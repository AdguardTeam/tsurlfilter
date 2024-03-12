/* eslint-disable class-methods-use-this */
import { WebRequestApi } from './web-request-api';
import {
    ConfigurationMV2,
    ConfigurationMV2Context,
    configurationMV2Validator,
} from './configuration';
import { Assistant } from './assistant';
import { LocalScriptRules, localScriptRulesService } from './services/local-script-rules-service';
import { RequestEvents } from './request';
import type { AppContext } from './context';
import type { StealthApi } from './stealth-api';
import type { TabsApi } from './tabs';
import type { TabsCosmeticInjector } from './tabs/tabs-cosmetic-injector';
import type { EngineApi } from './engine-api';
import type { RedirectsService } from './services/redirects/redirects-service';
import type { DocumentBlockingService } from './services/document-blocking-service';
import type { MessagesApi, MessageHandlerMV2 } from './messages-api';
import type { ExtSessionStorage } from './ext-session-storage';
import type {
    AppInterface,
    EventChannel,
    FilteringLog,
    FilteringLogEvent,
} from '../../common';

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
    public onFilteringLogEvent: EventChannel<FilteringLogEvent>;

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
        if (!this.appContext.isStorageInitialized) {
            return false;
        }

        return this.appContext.isAppStarted;
    }

    /**
     * Sets app running status.
     *
     * @param value Status value.
     */
    public set isStarted(value: boolean) {
        this.appContext.isAppStarted = value;
    }

    /**
     * Gets app configuration context.
     *
     * @throws Error if value not set.
     * @returns True if app started, else false.
     */
    public get configuration(): ConfigurationMV2Context {
        if (!this.appContext.configuration) {
            throw new Error('Configuration not set!');
        }

        return this.appContext.configuration;
    }

    /**
     * Sets app configuration context.
     *
     * @param value Status value.
     */
    public set configuration(value: ConfigurationMV2Context) {
        this.appContext.configuration = value;
    }

    /**
     * Creates new instance of {@link TsWebExtension}.
     *
     * @param appContext Top level app context storage.
     * @param tabsApi Wrapper around browser.tabs API.
     * @param engineApi TSUrlFilter Engine wrapper.
     * @param stealthApi Stealth api implementation.
     * @param messagesApi Wrapper around browser.runtime API.
     * @param tabCosmeticInjector Used to inject cosmetic rules into opened tabs on extension start.
     * @param redirectsService Service for working with redirects.
     * @param documentBlockingService Service encapsulate processing of $document modifier rules.
     * @param filteringLog Filtering log API.
     * @param extSessionStorage API for storing data described by SessionStorageSchema in the browser.storage.session.
     */
    constructor(
        private readonly appContext: AppContext,
        private readonly tabsApi: TabsApi,
        private readonly engineApi: EngineApi,
        private readonly stealthApi: StealthApi,
        private readonly messagesApi: MessagesApi,
        private readonly tabCosmeticInjector: TabsCosmeticInjector,
        private readonly redirectsService: RedirectsService,
        private readonly documentBlockingService: DocumentBlockingService,
        private readonly filteringLog: FilteringLog,
        private readonly extSessionStorage: ExtSessionStorage,
    ) {
        this.onFilteringLogEvent = this.filteringLog.onLogEvent;
        this.getMessageHandler = this.getMessageHandler.bind(this);
    }

    /**
     * Initialize app persistent data.
     * This method called as soon as possible and allows access
     * to the actual context before the app is started.
     */
    public async initStorage(): Promise<void> {
        await this.extSessionStorage.init();
        this.appContext.isStorageInitialized = true;
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
        configurationMV2Validator.parse(configuration);

        this.configuration = TsWebExtension.createConfigurationMV2Context(configuration);

        RequestEvents.init();
        await this.redirectsService.start();
        this.documentBlockingService.configure(configuration);
        await this.engineApi.startEngine(configuration);
        await this.tabCosmeticInjector.processOpenTabs();
        await this.tabsApi.start();
        WebRequestApi.start();
        Assistant.assistantUrl = configuration.settings.assistantUrl;

        await WebRequestApi.flushMemoryCache();
        await this.stealthApi.updateWebRtcPrivacyPermissions();

        this.isStarted = true;
    }

    /**
     * Fully stop request and tab processing.
     */
    public async stop(): Promise<void> {
        WebRequestApi.stop();
        this.tabsApi.stop();
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

        this.documentBlockingService.configure(configuration);
        await this.engineApi.startEngine(configuration);
        await this.tabsApi.updateCurrentTabsMainFrameRules();

        await WebRequestApi.flushMemoryCache();
        await this.stealthApi.updateWebRtcPrivacyPermissions();
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
        return this.engineApi.getRulesCount();
    }

    /**
     * Returns a message handler that will listen to internal messages,
     * for example: message for get computed css for content-script.
     *
     * @returns Messages handler.
     */
    public getMessageHandler(): MessageHandlerMV2 {
        return this.messagesApi.handleMessage;
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
        await this.stealthApi.updateWebRtcPrivacyPermissions();
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
     * Updates `debugScriptlets` configuration value without re-initialization of engine.
     *
     * @throws Error if {@link configuration} not set.
     * @param isDebugScriptlets `debugScriptlets` config value.
     */
    public setDebugScriptlets(isDebugScriptlets: boolean): void {
        this.configuration.settings.debugScriptlets = isDebugScriptlets;
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

        await this.stealthApi.updateWebRtcPrivacyPermissions();
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

        await this.stealthApi.updateWebRtcPrivacyPermissions();
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
