/**
 * @file
 * This file is part of Adguard API library (https://github.com/AdguardTeam/tsurlfilter/packages/adguard-api).
 *
 * Adguard API is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Adguard API is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adguard API. If not, see <http://www.gnu.org/licenses/>.
 */

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

export type NotifierListenersMap = { [K in NotifierEventType]: NotifierListener<K>[] };

/**
 * Type-safe mediator for app events
 *
 * Used for reduce modules coupling
 */
export class Notifier {
    // registered listeners mapping
    private listenersMap: NotifierListenersMap = {
        [NotifierEventType.DetectFilters]: [],
        [NotifierEventType.UpdateFilters]: [],
    };

    /**
     * Register listener for specified event.
     *
     * @param type - event type
     * @param listener - listener function
     */
    public addListener<T extends NotifierEventType>(type: T, listener: NotifierListener<T>): void {
        this.listenersMap[type].push(listener);
    }

    /**
     * Unregister listener for specified event.
     *
     * @param type - event type
     * @param listener - listener function
     */
    public removeListener<T extends NotifierEventType>(type: T, listener: NotifierListener<T>): void {
        const listeners = this.listenersMap[type];

        this.listenersMap[type] = listeners.filter((el) => el !== listener) as NotifierListenersMap[T];
    }

    /**
     * Execute all registered listeners for specified event type with passed data.
     *
     * @param event - event data
     */
    public publishEvent<T extends DetectFiltersEvent | UpdateFiltersEvent>(event: T): void {
        const listeners = this.listenersMap[event.type] as NotifierListener<NotifierEventType>[];

        listeners.forEach((listener) => {
            listener(event);
        });
    }
}

export const notifier = new Notifier();
