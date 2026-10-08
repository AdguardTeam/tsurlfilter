import { type Runtime } from 'webextension-polyfill';

import { type ProtectionPolicyArtifact, type RegistrationResult } from './canvas-protection/contracts';
import { type FilteringLogEvent } from './filtering-log';
import { type Message } from './message';
import { type EventChannelInterface } from './utils/channels';

export type MessageHandler = (
    message: Message,
    sender: Runtime.MessageSender,
) => Promise<unknown>;

export interface AppInterface<
    TConfiguration,
    TConfigurationContext,
    TConfigurationResult,
> {
    /**
     * Configuration context.
     */
    // TODO: make property required
    configuration?: TConfigurationContext;

    /**
     * Is app started.
     */
    isStarted: boolean;

    /**
     * Fires on filtering log event.
     */
    onFilteringLogEvent: EventChannelInterface<FilteringLogEvent>;

    /**
     * Fires when a rule has been created from the helper.
     */
    onAssistantCreateRule: EventChannelInterface<string>;

    /**
     * Starts api.
     *
     * @param configuration App configuration.
     */
    start: (configuration: TConfiguration) => Promise<TConfigurationResult>;

    /**
     * Updates configuration.
     *
     * @param configuration App configuration.
     */
    configure: (configuration: TConfiguration) => Promise<TConfigurationResult>;

    /**
     * Stops api.
     */
    stop: () => Promise<void>;

    /**
     * Launches assistant in the current tab.
     *
     * @param tabId Id of the tab to launch assistant in.
     */
    openAssistant: (tabId: number) => void;

    /**
     * Closes assistant.
     */
    closeAssistant: (tabId: number) => void;

    /**
     * Returns number of active rules.
     */
    getRulesCount: () => number;

    /**
     * Returns a message handler that will listen to internal messages,
     * for example: message for get computed css for content-script.
     *
     * @returns Messages handler.
     */
    getMessageHandler: () => MessageHandler;

    /**
     * Retrieves a rule text by its filter list identifier and rule index.
     *
     * If there's no rule by that index or the rule structure is invalid, it will return null.
     *
     * @param filterId Filter list identifier.
     * @param ruleIndex Rule index.
     *
     * @returns Rule text or `null`.
     */
    retrieveRuleText(filterId: number, ruleIndex: number): string | null;

    /**
     * Retrieves the original rule text by its filter list identifier and rule index.
     *
     * @param filterId Filter list identifier.
     * @param ruleIndex Rule index.
     *
     * @returns Rule text or `null`.
     */
    retrieveOriginalRuleText(filterId: number, ruleIndex: number): string | null;

    /**
     * Updates canvas opt-in and waits for the browser registration result.
     *
     * @param enabled Whether canvas protection is requested.
     */
    setCanvasProtectionEnabled(enabled: boolean): Promise<RegistrationResult>;

    /**
     * Replaces the prepared canvas protection policy.
     *
     * @param policy Prepared canvas exclusions and browser delivery selectors.
     */
    setCanvasProtectionPolicy(policy: ProtectionPolicyArtifact): Promise<RegistrationResult>;

    /**
     * Returns the most recent canvas protection registration result.
     */
    getCanvasProtectionState(): RegistrationResult;
}
