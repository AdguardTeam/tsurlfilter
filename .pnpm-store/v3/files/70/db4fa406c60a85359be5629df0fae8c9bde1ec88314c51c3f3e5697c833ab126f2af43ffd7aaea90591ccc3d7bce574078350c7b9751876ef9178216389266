/**
 * The purpose of ThrottleWrapper is to throttle calls of the function
 * that applies ExtendedCss rules. The reasoning here is that the function calls
 * are triggered by MutationObserver and there may be many mutations in a short period of time.
 * We do not want to apply rules on every mutation so we use this helper to make sure
 * that there is only one call in the given amount of time.
 */
export declare class ThrottleWrapper {
    private callback;
    private static readonly THROTTLE_DELAY_MS;
    private timerId?;
    private lastRunTime?;
    /**
     * Creates new ThrottleWrapper.
     * The {@link callback} should be executed not more often than {@link ThrottleWrapper.THROTTLE_DELAY_MS}.
     *
     * @param callback The callback.
     */
    constructor(callback: () => void);
    /**
     * Calls the {@link callback} function and update bounded throttle wrapper properties.
     */
    private executeCallback;
    /**
     * Schedules the {@link executeCallback} function execution via setTimeout.
     * It may triggered by MutationObserver job which may occur too ofter, so we limit the function execution:
     *
     * 1. If {@link timerId} is set, ignore the call, because the function is already scheduled to be executed;
     *
     * 2. If {@link lastRunTime} is set, we need to check the time elapsed time since the last call. If it is
     * less than {@link ThrottleWrapper.THROTTLE_DELAY_MS}, we schedule the function execution after the remaining time.
     *
     * Otherwise, we execute the function asynchronously to ensure that it is executed
     * in the correct order with respect to DOM events, by deferring its execution until after
     * those tasks have completed.
     */
    run(): void;
}
