/* eslint-disable no-console, no-undef, import/extensions */

import { loadResource, createRedirectFileUrl } from '../utils/resources.js';

/**
 * Redirects service class
 */
export class RedirectsService {
    redirects = null;

    /**
     * Initialize service
     */
    async init() {
        const rawYaml = await loadResource('redirects.yml');
        this.redirects = new Redirects(rawYaml);
    }

    /**
     * Creates url
     *
     * @param title
     * @return string|null
     */
    createRedirectUrl(title) {
        if (!title) {
            return null;
        }

        const redirectSource = this.redirects.getRedirect(title);
        if (!redirectSource) {
            console.debug(`There is no redirect source with title: "${title}"`);
            return null;
        }

        return createRedirectFileUrl(redirectSource.file);
    }
}
