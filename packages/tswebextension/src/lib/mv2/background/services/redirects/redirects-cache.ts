import { LRUCache } from 'lru-cache';

/**
 * RedirectsCache is used for new type of blocking redirects, like click2load.html.
 * Here we save redirected urls to check later for being able to view hidden frame after user
 * clicked on button "click to load".
 */
class RedirectsCache {
    /**
     * LRU Cache for URLs.
     */
    private cache: LRUCache<string, boolean>;

    /**
     * Constructor.
     */
    constructor() {
        this.cache = new LRUCache({ max: 100 });
    }

    /**
     * Adds url to the cache.
     *
     * @param url Url added to cache.
     */
    public add = (url: string): void => {
        this.cache.set(url, true);
    };

    /**
     * Checks if url is in the cache.
     *
     * @param url Url to check.
     *
     * @returns True if url is in the cache.
     */
    public hasUrl = (url: string): boolean => {
        return this.cache.has(url);
    };
}

export const redirectsCache = new RedirectsCache();
