import { LRUCache } from 'lru-cache';

import { nanoid } from '../../../../common/utils/nanoid';

/**
 * Used for new type of redirects, i.e.: click2load.html.
 * This tokens are transferred to redirect and used later to unblock page after user clicked button
 * "click to load".
 */
class RedirectsTokensCache {
    /**
     * LRU Cache for tokens.
     */
    private cache: LRUCache<string, boolean>;

    /**
     * Constructor.
     */
    constructor() {
        this.cache = new LRUCache({ max: 1000 });
    }

    /**
     * Generates random unblock token for url and saves it to cache.
     * Used for blocking redirect params creation {@link resourcesService.blockingUrlParams}.
     *
     * @returns Generated random string.
     */
    public generateToken = (): string => {
        const token = nanoid();
        this.cache.set(token, true);
        return token;
    };

    /**
     * Checks whether token exist in cache.
     * Used when redirect is checked in {@link resourcesService.shouldCreateRedirectUrl}.
     *
     * @param token Some string or null.
     *
     * @returns True if cache has such token.
     */
    public hasToken = (token: string | null): boolean => {
        if (!token) {
            return false;
        }
        return this.cache.has(token);
    };
}

export const redirectsTokensCache = new RedirectsTokensCache();
