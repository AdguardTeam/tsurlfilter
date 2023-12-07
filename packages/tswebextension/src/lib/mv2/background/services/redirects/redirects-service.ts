import { redirects } from '@adguard/scriptlets';
import type { Redirects } from '@adguard/scriptlets';
import type { ResourcesService } from '../resources-service';

import { redirectsCache } from './redirects-cache';
import { redirectsTokensCache } from './redirects-tokens-cache';
import { logger } from '../../../../common';

/**
 * Service for working with redirects.
 */
export class RedirectsService {
    redirects: Redirects | null = null;

    /**
     * Creates {@link RedirectsService} instance.
     * @param resourcesService Prevent web pages to identify extension through its web accessible resources.
     */
    constructor(
        private readonly resourcesService: ResourcesService,
    ) {}

    /**
     * Starts redirects service.
     */
    public async start(): Promise<void> {
        try {
            const rawYaml = await this.resourcesService.loadResource('redirects.yml');

            this.redirects = new redirects.Redirects(rawYaml);
        } catch (e) {
            throw new Error((e as Error).message);
        }
    }

    /**
     * Returns redirect url for the specified title.
     *
     * @param title Redirect title or null.
     * @param requestUrl Request url.
     * @returns Redirect url or null if redirect is not found.
     */
    public createRedirectUrl(title: string | null, requestUrl: string): string | null {
        if (!title) {
            return null;
        }

        if (!this.redirects) {
            return null;
        }

        const redirectSource = this.redirects.getRedirect(title);

        if (!redirectSource) {
            logger.debug(`There is no redirect source with title: "${title}"`);
            return null;
        }

        const shouldRedirect = this.shouldCreateRedirectUrl(title, requestUrl);
        if (!shouldRedirect) {
            return null;
        }

        // For blocking redirects we generate additional search params.
        const params = this.blockingUrlParams(title, requestUrl);

        return this.resourcesService.createResourceUrl(`redirects/${redirectSource.file}`, params);
    }

    /**
     * Check whether redirect creating is needed i.e.: for click2load.html it's not needed after
     * button click.
     *
     * @param redirectTitle A name of the redirect.
     * @param requestUrl Request url.
     * @returns True if should create redirect url.
     */
    private shouldCreateRedirectUrl = (redirectTitle: string, requestUrl: string): boolean => {
        // if no redirects loaded we won't be able to create redirect url;
        if (!this.redirects) {
            return false;
        }

        // no further checking is needed for most of the redirects
        // except blocking redirects, i.e. click2load.html
        if (!this.redirects.isBlocking(redirectTitle)) {
            return true;
        }

        // unblock token passed to redirect by createRedirectFileUrl and returned back.
        // it should be last parameter in url
        const UNBLOCK_TOKEN_PARAM = '__unblock';
        let cleanRequestUrl = requestUrl;
        const url = new URL(requestUrl);
        const params = new URLSearchParams(url.search);
        const unblockToken = params.get(UNBLOCK_TOKEN_PARAM);
        if (unblockToken) {
            // if redirect has returned unblock token back,
            // add url to cache for no further redirecting on button click;
            // save cleaned origin url so unblock token parameter should be cut off
            params.delete(UNBLOCK_TOKEN_PARAM);
            cleanRequestUrl = `${url.origin}${url.pathname}?${params.toString()}`;
            redirectsCache.add(cleanRequestUrl);
        }
        return !redirectsCache.hasUrl(cleanRequestUrl)
            || !redirectsTokensCache.hasToken(unblockToken);
    };

    /**
     * Builds blocking url search params.
     *
     * @param redirectTitle Title of the redirect.
     * @param requestUrl Request url.
     * @throws Error if this method called before redirects where set.
     * @returns Url search params.
     * @private
     */
    private blockingUrlParams(redirectTitle: string, requestUrl: string): URLSearchParams {
        if (!this.redirects) {
            throw new Error('This method should be called after redirects are loaded');
        }

        const params = new URLSearchParams();
        if (this.redirects.isBlocking(redirectTitle)) {
            const unblockToken = redirectsTokensCache.generateToken();
            params.set('__unblock', unblockToken);
            params.set('__origin', requestUrl);
        }
        return params;
    }
}
