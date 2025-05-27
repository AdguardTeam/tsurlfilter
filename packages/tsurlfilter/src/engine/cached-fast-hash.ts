import { LRUCache } from "lru-cache";
import { fastHash } from "../utils/string-utils";

export class CachedFastHash {
    private static readonly cache = new LRUCache<string, number>({
        max: 64,
    });

    /**
     * Returns the cached result of fastHash(hostname), or computes and stores it if missing.
     */
    static get(hostname: string): number {
        let cached = this.cache.get(hostname);
        if (cached !== undefined) {
            return cached;
        }

        const hashed = fastHash(hostname);
        this.cache.set(hostname, hashed);
        return hashed;
    }

    /**
     * Clears the cache, useful for testing or resetting state.
     */
    static clear(): void {
        this.cache.clear();
    }
}