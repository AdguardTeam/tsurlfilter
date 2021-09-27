import { IRule } from '../rules/rule';

/**
 * Rule list's cache
 */
export class ListCache {
    /**
     * Cache with the rules which were retrieved.
     */
    private readonly cache: Map<number, IRule>;

    /**
     * Constructor
     */
    constructor() {
        this.cache = new Map();
    }

    /**
     * @param key
     * @return rule for specified key
     */
    public get(key: number): IRule | undefined {
        return this.cache.get(key);
    }

    /**
     * Sets rule for specified key
     *
     * @param key
     * @param rule
     */
    public set(key: number, rule: IRule): void {
        this.cache.set(key, rule);
    }
}
