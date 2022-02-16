export type EventChannelListener<T> = (data: T) => void;
export type EventChannelDispatcher<T> = (data: T) => void;

export interface EventChannelInterface<T> {
    dispatch: EventChannelDispatcher<T>;
    subscribe: (listener: EventChannelListener<T>) => void;
    unsubscribe: (listener: EventChannelListener<T>) => void;
}

/**
 * Simple pub-sub implementation
 */
export class EventChannel<T> implements EventChannelInterface<T> {
    private listeners: EventChannelListener<T>[] = [];

    public dispatch(data: T): void {
        this.listeners.forEach((listener) => listener(data));
    }

    public subscribe(listener: EventChannelListener<T>): void {
        this.listeners.push(listener);
    }

    public unsubscribe(listener: EventChannelListener<T>): void {
        const index = this.listeners.indexOf(listener);

        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
    }
}
