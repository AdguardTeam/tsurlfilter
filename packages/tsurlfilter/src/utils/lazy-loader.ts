/**
 * Generic lazy loader that encapsulates the flag + in-flight promise dedup
 * pattern for on-demand loading and unloading of heavy data.
 *
 * @template T The type of the lazily loaded value.
 */
export class LazyLoader<T> {
    /**
     * The loaded value, or `undefined` if not yet loaded or already unloaded.
     */
    private value: T | undefined;

    /**
     * In-flight promise used to deduplicate concurrent load calls.
     */
    private inflightPromise: Promise<void> | undefined;

    /**
     * Whether the value is currently loaded.
     */
    private loaded = false;

    /**
     * Creates a new lazy loader.
     *
     * @param loader Function that performs the actual loading.
     */
    constructor(private readonly loader: () => Promise<T>) {}

    /**
     * Returns the loaded value, triggering a load if necessary.
     * Concurrent calls while loading is in progress will wait for the same
     * in-flight promise instead of starting a second load.
     *
     * @returns Promise resolving to the loaded value.
     */
    public async get(): Promise<T> {
        if (this.loaded) {
            return this.value!;
        }

        if (this.inflightPromise) {
            await this.inflightPromise;
            return this.value!;
        }

        this.inflightPromise = this.loader().then((v) => {
            this.value = v;
            this.loaded = true;
            this.inflightPromise = undefined;
        });

        await this.inflightPromise;
        return this.value!;
    }

    /**
     * Unloads the value, freeing memory.
     * If a load is currently in progress, the unload is deferred until it
     * completes. If nothing is loaded, this is a no-op.
     *
     * @param onUnload Optional callback invoked with the current value just
     * before it is cleared, useful for cascading unloads (e.g. unloading
     * nested resources).
     */
    public unload(onUnload?: (value: T) => void): void {
        if (!this.loaded && !this.inflightPromise) {
            return;
        }

        if (this.inflightPromise) {
            this.inflightPromise.finally(() => this.unload(onUnload));
            return;
        }

        if (onUnload && this.value !== undefined) {
            onUnload(this.value);
        }

        this.value = undefined;
        this.loaded = false;
    }

    /**
     * Whether the value is currently loaded.
     *
     * @returns `true` if the value is loaded.
     */
    public isLoaded(): boolean {
        return this.loaded;
    }
}
