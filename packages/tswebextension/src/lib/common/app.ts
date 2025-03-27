import { type AnyRule } from '@adguard/agtree';
import { type Runtime } from 'webextension-polyfill';

import { type FilteringLogEvent } from './filtering-log';
import { type EventChannelInterface } from './utils/channels';
import { type Message } from './message';

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
     * Retrieves a rule node by its filter list identifier and rule index.
     *
     * If there's no rule by that index or the rule structure is invalid, it will return null.
     *
     * @param filterId Filter list identifier.
     * @param ruleIndex Rule index.
     *
     * @returns Rule node or `null`.
     */
    retrieveRuleNode(filterId: number, ruleIndex: number): AnyRule | null;
}
