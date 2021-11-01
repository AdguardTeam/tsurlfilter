export type EventChannelListener = (...args: unknown[]) => unknown;
export type EventChannelDispatcher = (...args: unknown[]) => void;

export interface EventChannelInterface {
    dispatch: EventChannelDispatcher;
    subscribe: (listener: EventChannelListener) => void;
    unsubscribe: (listener: EventChannelListener) => void;
}

/**
 * Simple pub-sub implementation
 */
export class EventChannel implements EventChannelInterface {
    private listeners: EventChannelListener[] = [];

    public dispatch(...args: unknown[]): void {
        this.listeners.forEach(listener => listener(...args));
    }

    public subscribe(listener: EventChannelListener): void {
        this.listeners.push(listener);
    }

    public unsubscribe(listener: EventChannelListener): void {
        const index = this.listeners.indexOf(listener);

        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
    }
}