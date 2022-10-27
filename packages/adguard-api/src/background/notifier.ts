export enum NotifierEventType {
    DetectFilters = "DetectFilters",
    UpdateFilters = "UpdateFilters",
}

export type DetectFiltersEvent = {
    type: NotifierEventType.DetectFilters;
    data: {
        filtersIds: number[];
    };
};

export type UpdateFiltersEvent = {
    type: NotifierEventType.UpdateFilters;
};

export type NotifierEvent = DetectFiltersEvent | UpdateFiltersEvent;

export type ExtractedNotifierEvent<T> = Extract<NotifierEvent, { type: T }>;

export type NotifierListener<T extends NotifierEventType> = (value: ExtractedNotifierEvent<T>) => void | Promise<void>;

/**
 * Type-safe mediator for app events
 */
export class Notifier {
    private listenersMap = new Map();

    public addListener<T extends NotifierEventType>(type: T, listener: NotifierListener<T>): void {
        this.listenersMap.set(type, listener);
    }

    public publishEvent<T extends NotifierEvent>(event: T): void {
        const listener = this.listenersMap.get(event.type);
        if (listener) {
            listener(event);
        }
    }
}

export const notifier = new Notifier();
