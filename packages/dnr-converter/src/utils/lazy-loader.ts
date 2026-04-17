/**
 * @file Generic lazy-loader utility that wraps an async producer with result
 * caching, in-flight-call coalescing, and safe unload-during-load handling.
 */

/**
 * Wraps an async producer function and caches its result after the first
 * successful call.
 *
 * Responsibilities:
 * - **Caching** — after the producer resolves, subsequent {@link get} calls
 *   return the cached value synchronously (as a resolved promise) without
 *   invoking the producer again.
 * - **Coalescing** — concurrent {@link get} calls made while a load is in
 *   flight share the same promise; the producer is invoked at most once per
 *   load cycle.
 * - **Retry on failure** — if the producer rejects, the in-flight promise is
 *   cleared so the next {@link get} call re-invokes it.
 * - **Safe reset during load** — {@link reset} called while a load is in
 *   flight defers clearing the cached value until the load settles, preventing
 *   a load from being silently overwritten or an infinite reset loop.
 *
 * @template T Type of the produced value. Use `void` for side-effect-only
 * producers that populate external state.
 */
export class LazyLoader<T> {
    /**
     * Cached value after a successful load. Only meaningful when {@link loaded}
     * is `true` (kept as a separate flag to support `T = void` and falsy values).
     */
    private value: T | undefined;

    /**
     * `true` once the producer has resolved at least once and the value has
     * not been reset since.
     */
    private loaded = false;

    /**
     * In-flight producer promise; `null` when no load is in progress.
     */
    private loadingPromise: Promise<T> | null = null;

    /**
     * Async producer invoked on first {@link get} (or after {@link reset}).
     */
    private readonly producer: () => Promise<T>;

    /**
     * Constructs a new lazy loader.
     *
     * @param producer Async function that produces the value to cache.
     */
    constructor(producer: () => Promise<T>) {
        this.producer = producer;
    }

    /**
     * Returns the cached value, awaiting the in-flight load or starting a new
     * one as needed.
     *
     * @returns Promise resolving to the produced value.
     *
     * @throws Whatever the producer throws (not wrapped).
     */
    public async get(): Promise<T> {
        if (this.loaded) {
            return this.value as T;
        }

        if (this.loadingPromise !== null) {
            return this.loadingPromise;
        }

        // Assign the promise synchronously so concurrent callers coalesce onto it.
        this.loadingPromise = (async (): Promise<T> => {
            try {
                const v = await this.producer();
                this.value = v;
                this.loaded = true;
                return v;
            } finally {
                // Must be cleared here (not only on error) — `reset()` checks
                // `loadingPromise !== null` to detect an in-flight load and
                // would enter an infinite .finally() scheduling loop if this
                // field still held a resolved promise after the load completed.
                this.loadingPromise = null;
            }
        })();

        return this.loadingPromise;
    }

    /**
     * Returns `true` if the value has been successfully loaded and not reset.
     *
     * @returns Whether the cached value is available.
     */
    public isLoaded(): boolean {
        return this.loaded;
    }

    /**
     * Returns `true` if a load is currently in flight.
     *
     * @returns Whether a producer call is pending.
     */
    public isLoading(): boolean {
        return this.loadingPromise !== null;
    }

    /**
     * Clears the cached value so the next {@link get} call re-invokes the
     * producer. If a load is currently in flight, the reset is deferred until
     * it settles to avoid overwriting fresh state with `null` or racing with
     * callers waiting on the promise.
     *
     * Fire-and-forget is intentional here: the deferred reset runs as a
     * microtask after the in-flight load settles and has no observable
     * consumers beyond the cache state. Producer errors are silently
     * swallowed because they are already surfaced to the caller of
     * {@link get}.
     */
    public reset(): void {
        if (this.loadingPromise !== null) {
            // Defer reset until the in-flight load settles. The recursive
            // `reset()` call then runs the clear branch below (or defers again
            // if a new load has started in the meantime, which is also fine).
            this.loadingPromise.finally(() => {
                this.reset();
            }).catch(() => {
                // Empty on purpose. `.finally()` does not swallow rejections —
                // it re-throws the producer error into this chain. Without
                // `.catch()` that duplicate rejection would bubble up as an
                // unhandled rejection, because nothing awaits this chain.
                // The original error is still delivered to whoever awaited
                // `get()`.
            });
            return;
        }
        this.value = undefined;
        this.loaded = false;
    }
}
