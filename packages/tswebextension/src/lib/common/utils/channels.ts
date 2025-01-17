export type EventChannelListener<T> = (data: T) => void;

type EventChannelDispatcher<T> = (data: T) => void;

export interface EventChannelInterface<T> {
    dispatch: EventChannelDispatcher<T>;
    subscribe: (listener: EventChannelListener<T>) => void;
    unsubscribe: (listener: EventChannelListener<T>) => void;
}

/**
 * Simple pub-sub implementation.
 */
export class EventChannel<T> implements EventChannelInterface<T> {
    private listeners: EventChannelListener<T>[] = [];

    /**
     * Dispatch event.
     *
     * @param data Event data.
     */
    public dispatch(data: T): void {
        this.listeners.forEach((listener) => listener(data));
    }

    /**
     * Subscribe to events channel.
     *
     * @param listener Callback to be called on event.
     */
    public subscribe(listener: EventChannelListener<T>): void {
        this.listeners.push(listener);
    }

    /**
     * Unsubscribe from events channel.
     *
     * @param listener Callback to be removed from listeners.
     */
    public unsubscribe(listener: EventChannelListener<T>): void {
        const index = this.listeners.indexOf(listener);

        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
    }
}
