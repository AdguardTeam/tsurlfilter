/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-unused-vars */
export interface Configuration {
    /**
     * An array of filters identifiers.
     * You can look for possible filters identifiers in the filters metadata file:
     * https://filters.adtidy.org/extension/chromium/filters.json
     */
    filters: number[];
    /**
     * An absolute path to a file, containing filters metadata.
     * Once started, AdGuard will periodically check filters updates by downloading this file.
     *
     * Example: https://path.to/filters/metadata.json
     */
    filtersMetadataUrl: string;
    /**
     * URL mask used for fetching filters rules.
     * {filter_id} parameter will be replaced with an actual filter identifier.
     *
     * Example: https://path.to/filters/{filter_id}.txt
     */
    filterRulesUrlMask: string;
    /**
     * An array of domains, for which AdGuard won't work.
     */
    allowlist?: string[];
    /**
      * If it is true, Adguard will work for domains from the allowlist only.
      * All other domains will be ignored.
      */
    isAllowlistInverted?: boolean;
    /**
      * An array of custom filtering rules.
      * Filtering rules syntax is described here:
      * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters
      *
      * These custom rules might be created by a user via AdGuard Assistant UI.
      */
    rules?: string[];
}

export interface EventChannel {
    addListener: (callback: Function) => void;

    removeListener: (callback: Function) => void;

    notify: (...args: unknown[]) => unknown;

    notifyInReverseOrder: (...args: unknown[]) => unknown;
}

export interface IApp {
    /**
     * Initializes AdGuard and starts it immediately.
     */
    start: (configuration: Configuration, callback?: Function) => void;

    /**
     * Completely stops AdGuard.
     */
    stop: (callback?: Function) => void;

    /**
     * Updates AdGuard configuration. Please note, that Adguard must be already started.
     */
    configure: (configuration: Configuration, callback?: Function) => void;

    /**
     * Opens the AdGuard assistant UI in the specified tab.
     * You should also add a listener for messages with type assistant-create-rule for rules,
     * which are created by the Adguard assistant.
     */
    openAssistant: (tabId: number) => void;

    /**
     * Allows adding and removing listeners for request blocking events.
     */
    closeAssistant: (tabId: number) => void;

    onRequestBlocked: EventChannel;
}

export class App implements IApp {
    public start(configuration: Configuration, callback?: Function): void {
        // TODO: implement
    }

    public stop(callback?: Function): void {
        // TODO: implement
    }

    public configure(configuration: Configuration, callback?: Function): void {
        // TODO: implement
    }

    public openAssistant(tabId: number): void {
        // TODO: implement
    }

    public closeAssistant(tabId: number): void {
        // TODO: implement
    }

    public onRequestBlocked: EventChannel = {
        notify: () => {},
        notifyInReverseOrder: () => {},
        addListener: (() => {}),
        removeListener: (() => {}),
    };
}
