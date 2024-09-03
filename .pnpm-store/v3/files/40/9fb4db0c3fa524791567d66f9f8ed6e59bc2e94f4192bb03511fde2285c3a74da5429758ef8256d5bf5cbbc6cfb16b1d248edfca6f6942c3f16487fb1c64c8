/**
 * We use EventTracker to track the event that is likely to cause the mutation.
 * The problem is that we cannot use `window.event` directly from the mutation observer call
 * as we're not in the event handler context anymore.
 */
export declare class EventTracker {
    private trackedEvents;
    private lastEventType?;
    private lastEventTime?;
    /**
     * Creates new EventTracker.
     */
    constructor();
    /**
     * Callback for event listener for events tracking.
     *
     * @param event Any event.
     */
    private trackEvent;
    private getLastEventType;
    private getTimeSinceLastEvent;
    /**
     * Checks whether the last caught event should be ignored.
     *
     * @returns True if event should be ignored.
     */
    isIgnoredEventType(): boolean;
    /**
     * Stops event tracking by removing event listener.
     */
    stopTracking(): void;
}
