/**
 * This storage is used to keep track of counted rules received from node elements.
 */
export class HitsStorage {
    /**
     * Map storage.
     *
     * A `WeakMap` is used so that counted elements are not retained for the
     * page lifetime. This matters for the short-lived probes collected during
     * loading: their detached subtrees are not referenced anywhere else once
     * they are dropped, and the storage must not keep them alive.
     */
    private map = new WeakMap<object, string>();

    /**
     * Checks if element is counted.
     *
     * @param element Html element.
     * @param rule Rule text.
     *
     * @returns True if element is counted.
     */
    public isCounted(element: object, rule: string): boolean {
        return this.map.get(element) === rule;
    }

    /**
     * Stores rule-element info in storage.
     *
     * @param element Html element.
     * @param rule Rule text.
     */
    public setCounted(element: object, rule: string): void {
        this.map.set(element, rule);
    }
}
