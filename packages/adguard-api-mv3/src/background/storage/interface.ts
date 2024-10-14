/**
 * Common storage interface with basic operations.
 */
export interface StorageInterface<
    K extends string | number | symbol = string,
    V = unknown,
    Mode extends 'sync' | 'async' = 'sync',
> {
    set(key: K, value: V): Mode extends 'async' ? Promise<void> : void

    get(key: K): Mode extends 'async' ? Promise<V> : V

    remove(key: K): Mode extends 'async' ? Promise<void> : void
}

/**
 * Extended storage interface with additional operations.
 */
export interface ExtendedStorageInterface<
    K extends string | number | symbol = string,
    V = unknown,
    Mode extends 'sync' | 'async' = 'sync',
> extends StorageInterface<K, V, Mode> {
    setMultiple(data: Record<K, V>): Mode extends 'async' ? Promise<boolean> : boolean

    removeMultiple(keys: K[]): Mode extends 'async' ? Promise<boolean> : boolean

    entries(): Mode extends 'async' ? Promise<Record<K, V>> : Record<K, V>

    keys(): Mode extends 'async' ? Promise<K[]> : K[]

    clear(): Mode extends 'async' ? Promise<void> : void
}
