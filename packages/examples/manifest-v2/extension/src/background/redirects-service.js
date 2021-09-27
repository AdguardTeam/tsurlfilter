/* eslint-disable no-console,@typescript-eslint/explicit-function-return-type,import/no-extraneous-dependencies */
import { redirects } from '@adguard/scriptlets';

import { loadResource, createRedirectFileUrl } from './utils/resources';

const { Redirects } = redirects;

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
