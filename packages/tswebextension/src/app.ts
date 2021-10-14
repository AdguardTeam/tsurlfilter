/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { validateConfiguration, Configuration } from './configuration';

export type UnknownFunction = (...args: unknown[]) => unknown;
export interface EventChannel {
    addListener: (callback: UnknownFunction) => void;

    removeListener: (callback: UnknownFunction) => void;

    notify: UnknownFunction;

    notifyInReverseOrder: UnknownFunction;
}

export interface IApp {
    /**
     * Initializes AdGuard and starts it immediately.
     */
    start: (configuration: Configuration) => Promise<void>;

    /**
     * Completely stops AdGuard.
     */
    stop: () => Promise<void>;

    /**
     * Updates AdGuard configuration. Please note, that Adguard must be already started.
     */
    configure: (configuration: Configuration) => Promise<void>;

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
    public async start(configuration: Configuration): Promise<void> {
        validateConfiguration(configuration);

        console.log(configuration);

        // TODO: implement
    }

    public async stop(): Promise<void> {
        // TODO: implement
    }

    public async configure(configuration: Configuration): Promise<void> {
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