import { type AnyRule } from '@adguard/agtree';

import { type FilteringLogEvent } from './filtering-log';
import { type EventChannelInterface } from './utils/channels';

export interface AppInterface<
    TConfiguration,
    TConfigurationContext,
    TConfigurationResult,
    TMessageHandler,
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
    onFilteringLogEvent: EventChannelInterface<FilteringLogEvent>,

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
    getMessageHandler: () => TMessageHandler;

    /**
     * Retrieves rule node from a dynamic filter.
     * Dynamic filters are filters that are not loaded from the storage but created on the fly.
     *
     * @param filterId Filter id.
     * @param ruleIndex Rule index.
     * @returns Rule node or null.
     */
    retrieveDynamicRuleNode(filterId: number, ruleIndex: number): AnyRule | null;
}
