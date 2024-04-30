/**
 * @file Compatibility tables types.
 */

// this is a helper structure to avoid storing the same data multiple times
// note: we never plan to export this, only use it internally
interface MapWithSharedStorage<K extends string | number | symbol, V> {
    shared: V[];
    map: Record<K, number>;
}

export type CompatibilityTableRow<T> = MapWithSharedStorage<number, T>;

export type CompatibilityTable<T> = MapWithSharedStorage<string, CompatibilityTableRow<T>>;
