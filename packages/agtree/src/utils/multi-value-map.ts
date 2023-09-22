import { isUndefined } from './common';

/**
 * A very simple map extension that allows to store multiple values for the same key
 * by storing them in an array.
 *
 * @todo Add more methods if needed
 */
export class MultiValueMap<K, V> extends Map<K, V[]> {
    /**
     * Adds a value to the map. If the key already exists, the value will be appended to the existing array,
     * otherwise a new array will be created for the key.
     *
     * @param key Key to add
     * @param values Value(s) to add
     */
    public add(key: K, ...values: V[]): void {
        let currentValues = super.get(key);

        if (isUndefined(currentValues)) {
            currentValues = [];
            super.set(key, values);
        }

        currentValues.push(...values);
    }
}
