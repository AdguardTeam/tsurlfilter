/* eslint-disable no-console, no-undef, import/extensions */

import { loadResource } from '../utils/resources.js';

/**
 * Redirects service class
 */
export class RedirectsService {
    redirects = null;

    /**
     * Constructor
     */
    constructor() {
        (async () => {
            const rawYaml = await loadResource('redirects.yml');
            this.redirects = new Redirects(rawYaml);
        })();
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

        let { content, contentType } = redirectSource;
        // if contentType does not include "base64" string we convert it to base64
        const BASE_64 = 'base64';
        if (!contentType.includes(BASE_64)) {
            content = window.btoa(content);
            contentType = `${contentType};${BASE_64}`;
        }

        return `data:${contentType},${content}`;
    }
}
