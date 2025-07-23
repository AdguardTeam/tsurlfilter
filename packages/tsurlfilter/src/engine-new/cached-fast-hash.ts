import { LRUCache } from 'lru-cache';
import { fastHash } from '../utils/string-utils';

/**
 * CachedFastHash provides a caching layer for fastHash function to avoid recomputing hashes for the same hostname.
 * It uses an LRU cache to store the results of fastHash calls.
 */
export class CachedFastHash {
    /**
     * Maximum number of entries allowed in the hostname hash cache.
     *
     * A limit of 64 provides a balance between memory efficiency and performance.
     * It is large enough to cache commonly repeated hostnames in a typical session
     * while avoiding excessive memory usage. Since fastHash is relatively fast,
     * this small cache size effectively eliminates most redundant computations
     * without requiring significant memory.
     */
    private static readonly MAX_CACHE_SIZE = 64;

    /**
     * LRU cache to store hostname hashes.
     * The cache size is limited to 64 entries.
     */
    private static readonly cache = new LRUCache<string, number>({
        max: CachedFastHash.MAX_CACHE_SIZE,
    });

    /**
     * Returns the cached result of fastHash(hostname), or computes and stores it if missing.
     *
     * @param hostname Hostname to hash.
     *
     * @returns Cached hash value.
     */
    static get(hostname: string): number {
        const cached = this.cache.get(hostname);
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
