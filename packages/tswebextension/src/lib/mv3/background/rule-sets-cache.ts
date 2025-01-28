import { type RuleSet } from '@adguard/tsurlfilter/es/declarative-converter';
import { LRUCache } from 'lru-cache';

/**
 * Cache for rule sets.
 */
export class RuleSetsCache {
    private cache: LRUCache<string, RuleSet>;

    /**
     * Creates new RuleSetsCache.
     */
    constructor() {
        this.cache = new LRUCache({
            max: 100,
        });
    }

    /**
     * Checks if cache has rule set with provided id.
     *
     * @param id Rule set id.
     *
     * @returns True if cache has rule set with provided id.
     */
    public has(id: string): boolean {
        return this.cache.has(id);
    }

    /**
     * Sets rule set with provided id.
     *
     * @param id Rule set id.
     * @param ruleSet Rule set.
     */
    public set(id: string, ruleSet: RuleSet): void {
        this.cache.set(id, ruleSet);
    }

    /**
     * Returns rule set with provided id.
     *
     * @param id Rule set id.
     *
     * @returns Rule set with provided id or undefined if not found.
     */
    public get(id: string): RuleSet | undefined {
        return this.cache.get(id);
    }

    /**
     * Removes rule set with provided id.
     *
     * @param id Rule set id.
     */
    public remove(id: string): void {
        this.cache.delete(id);
    }

    /**
     * Clears cache, optionally excluding provided ids.
     *
     * @param exceptIds Rule set ids to exclude from clearing.
     */
    public clear(exceptIds: string[] | null = null): void {
        if (exceptIds) {
            this.cache.forEach((_, key) => {
                if (!exceptIds.includes(key)) {
                    this.cache.delete(key);
                }
            });
            return;
        }

        this.cache.clear();
    }

    /**
     * Unloads content of all rule sets in cache, optionally excluding provided ids.
     *
     * @param exceptIds Rule set ids to exclude from unloading.
     */
    public unloadContents(exceptIds: string[] | null = null): void {
        if (exceptIds) {
            this.cache.forEach((ruleSet, key) => {
                if (!exceptIds.includes(key)) {
                    ruleSet.unloadContent();
                }
            });
            return;
        }

        this.cache.forEach((ruleSet) => {
            ruleSet.unloadContent();
        });
    }
}
