import { LRUMap } from 'lru_map';

/**
 * RedirectsCache is used for new type of blocking redirects, like click2load.html.
 * Here we save redirected urls to check later for being able to view hidden frame after user
 * clicked on button "click to load".
 */
class RedirectsCache {
    /**
     * Instance or LRUMap.
     */
    cache = new LRUMap(100);

    /**
     * Adds url to the cache.
     *
     * @param url Url added to cache.
     */
    add = (url: string): void => {
        this.cache.set(url, true);
    };

    /**
     * Checks if url is in the cache.
     *
     * @param url Url to check.
     * @returns True if url is in the cache.
     */
    hasUrl = (url: string): boolean => {
        return this.cache.has(url);
    };
}

export const redirectsCache = new RedirectsCache();
