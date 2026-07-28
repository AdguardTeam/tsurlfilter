/**
 * @file Generic synchronous lazy-initialisation utility that wraps a producer
 * function and caches its result after the first call to {@link Lazy.get}.
 */

/**
 * Wraps a synchronous producer function and caches its result after the first
 * successful {@link get} call.
 *
 * Responsibilities:
 * - **Caching** — after the producer runs, subsequent {@link get} calls return
 *   the cached value without invoking the producer again.
 * - **Falsy-safe** — caching is tracked by a separate `loaded` flag so that
 *   falsy produced values (`0`, `null`, `undefined`) are still cached.
 *
 * This is the synchronous counterpart of {@link LazyLoader}, intended for
 * cheap synchronous producers where introducing promise machinery would be
 * counterproductive.
 *
 * @template T Type of the produced value.
 */
export class Lazy<T> {
    /**
     * Cached value after the producer has run. Only meaningful when
     * {@link loaded} is `true` (kept as a separate flag to support falsy
     * values).
     */
    private value: T | undefined;

    /**
     * `true` once the producer has run and the value has not been reset.
     */
    private loaded = false;

    /**
     * Producer invoked on the first {@link get} call.
     */
    private readonly producer: () => T;

    /**
     * Constructs a new lazy wrapper.
     *
     * @param producer Function that produces the value to cache.
     */
    constructor(producer: () => T) {
        this.producer = producer;
    }

    /**
     * Returns the cached value, invoking the producer on the first call.
     *
     * @returns The produced (and cached) value.
     */
    public get(): T {
        if (!this.loaded) {
            this.value = this.producer();
            this.loaded = true;
        }
        return this.value as T;
    }

    /**
     * Returns `true` if the producer has run and the value is cached.
     *
     * @returns Whether the cached value is available.
     */
    public isLoaded(): boolean {
        return this.loaded;
    }
}
