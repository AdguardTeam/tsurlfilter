/**
 * Controllable `MutationObserver` mock for jsdom tests.
 *
 * The real jsdom implementation is asynchronous and its callbacks can outlive
 * the test environment; this mock allows triggering mutation callbacks
 * synchronously.
 */
export class MutationObserverMock {
    /**
     * All created instances in the order of creation.
     */
    public static instances: MutationObserverMock[] = [];

    /**
     * Mutation callback.
     */
    private callback: MutationCallback;

    /**
     * Nodes passed to the last {@link observe} call.
     */
    public observedNodes: Node[] = [];

    /**
     * Options passed to the last {@link observe} call.
     */
    public observedOptions: MutationObserverInit | undefined;

    /**
     * Whether the observer is disconnected.
     */
    private disconnected = false;

    /**
     * Records queued for {@link takeRecords} but not delivered to the
     * callback.
     */
    private queuedRecords: MutationRecord[] = [];

    /**
     * Creates a new mock instance.
     *
     * @param callback Mutation callback.
     */
    constructor(callback: MutationCallback) {
        this.callback = callback;
        MutationObserverMock.instances.push(this);
    }

    /**
     * Returns the last created instance.
     *
     * @returns Last created instance or undefined.
     */
    public static get last(): MutationObserverMock | undefined {
        return MutationObserverMock.instances[MutationObserverMock.instances.length - 1];
    }

    /**
     * Disconnect mock.
     */
    public disconnect(): void {
        this.disconnected = true;
        // A real `disconnect()` drops the record queue as well.
        this.queuedRecords = [];
    }

    /**
     * Observe mock.
     *
     * @param target Node to observe.
     * @param options Observation options.
     */
    public observe(target: Node, options?: MutationObserverInit): void {
        this.disconnected = false;
        this.observedNodes.push(target);
        this.observedOptions = options;
    }

    /**
     * Returns whether the observer is disconnected.
     *
     * @returns True if the observer is disconnected.
     */
    public get isDisconnected(): boolean {
        return this.disconnected;
    }

    /**
     * Take records mock.
     *
     * @returns Queued records and clears the queue.
     */
    public takeRecords(): MutationRecord[] {
        return this.queuedRecords.splice(0);
    }

    /**
     * Queues records for {@link takeRecords} without invoking the callback,
     * like records that are pending delivery in a real observer.
     *
     * @param mutations Mutations to queue.
     */
    public enqueueRecords(mutations: MutationRecord[]): void {
        this.queuedRecords.push(...mutations);
    }

    /**
     * Triggers the mutation callback.
     *
     * @param mutations Mutations to trigger.
     */
    public trigger(mutations: MutationRecord[]): void {
        if (this.disconnected) {
            return;
        }

        this.callback(mutations, this as unknown as MutationObserver);
    }
}

/**
 * Replaces the global `MutationObserver` with {@link MutationObserverMock}.
 *
 * @returns Function restoring the original `MutationObserver`.
 */
export const mockMutationObserver = (): () => void => {
    const original = window.MutationObserver;
    MutationObserverMock.instances = [];
    window.MutationObserver = MutationObserverMock as unknown as typeof MutationObserver;

    return () => {
        window.MutationObserver = original;
        MutationObserverMock.instances = [];
    };
};
