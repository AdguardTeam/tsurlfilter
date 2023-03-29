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
import { EventChannel } from "@adguard/tswebextension";
import { Configuration } from "./schemas";
import { RequestBlockingLogger } from "./request-blocking-logger";
export declare const WEB_ACCESSIBLE_RESOURCES_PATH = "adguard";
/**
 * AdGuard API is filtering library, provided following features:
 * - request and content filtering, using {@link TsWebExtension}
 * - filters rules downloading and caching via {@link FiltersApi}
 * - filters rules auto updates via {@link filtersUpdateService}
 * - content blocking via AdGuard Assistant UI, provided by {@link TsWebExtension}
 * - auto detecting language filters via {@link localeDetectService}
 * - logging request processing via filtering events api, provided by {@link TsWebExtension}
 */
export declare class AdguardApi {
    private tswebextension;
    private network;
    private filtersApi;
    private filtersUpdateService;
    private localeDetectService;
    private configuration;
    private logger;
    /**
     * {@link TsWebExtension} {@link EventChannel}, which fires event on assistant rule creation.
     */
    onAssistantCreateRule: EventChannel<string>;
    /**
     * API for adding and removing listeners for request blocking events.
     *
     */
    onRequestBlocked: RequestBlockingLogger;
    constructor();
    /**
     * Initializes AdGuard with specified {@link Configuration} and starts it immediately.
     *
     * @param configuration - api {@link Configuration}
     * @returns applied {@link Configuration} promise
     */
    start(configuration: Configuration): Promise<Configuration>;
    /**
     * Completely stops AdGuard
     */
    stop(): Promise<void>;
    /**
     * Modifies AdGuard {@link Configuration}. Please note, that Adguard must be already started.
     *
     * @param configuration - api {@link Configuration}
     * @returns applied {@link Configuration} promise
     */
    configure(configuration: Configuration): Promise<Configuration>;
    /**
     * Opens the AdGuard assistant UI in the specified tab.
     * You should also subscribe on {@link onAssistantCreateRule} event channel for applying rules,
     * which are created by the Adguard assistant.
     *
     * @param tabId - {@link browser.tabs.Tab } id. @see https://developer.chrome.com/docs/extensions/reference/tabs/#type-Tab
     */
    openAssistant(tabId: number): Promise<void>;
    /**
     * Closes AdGuard assistant in the specified tab.
     *
     * @param tabId - {@link browser.tabs.Tab } id. @see https://developer.chrome.com/docs/extensions/reference/tabs/#type-Tab
     */
    closeAssistant(tabId: number): Promise<void>;
    /**
     * Gets current loaded rules count
     *
     * @returns rules count number
     */
    getRulesCount(): number;
    /**
     * Creates {@link TsWebExtension} configuration based on current API {@link configuration}.
     *
     * @returns - {@link TsWebExtension} configuration
     */
    private createTsWebExtensionConfiguration;
    /**
     * Handles messages from {@link TsWebExtension} content-script
     *
     * @param message - {@link TsWebExtension} extension {@link Message}
     * @param sender - extension {@link Runtime.MessageSender}
     * @returns TsWebExtension message handler response
     */
    private handleMessage;
    /**
     * Handles fired {@link UpdateFiltersEvent}
     */
    private handleUpdateFilters;
    /**
     * Handles fired {@link DetectFiltersEvent}
     *
     * @param event - fired {@link DetectFiltersEvent}
     */
    private handleDetectFilters;
    /**
     * Creates new adguardApi instance
     *
     * @returns AdguardApi instance
     */
    static create(): AdguardApi;
}
