export type EventChannelListener = (...args: unknown[]) => unknown;
export type EventChannelDispatcher = (...args: unknown[]) => unknown;

export interface EventChannelInterface {
    dispatch: EventChannelDispatcher;
    subscribe: (listener: EventChannelListener) => () => void;
}

/**
 * Simple pub-sub implementation
 */
export class EventChannel implements EventChannelInterface {
    private listeners: EventChannelListener[] = [];

    public dispatch(...args: unknown[]){
        this.listeners.forEach(listener => listener(...args));
    }

    public subscribe(listener: EventChannelListener){
        this.listeners.push(listener);

        // unsubscribe
        return () => {
            const index = this.listeners.indexOf(listener);

            if (index !== -1) {
                this.listeners.splice(index, 1);
            }
        };
    }
}