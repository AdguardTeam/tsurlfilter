import { getDomain } from 'tldts';

import { type CompaniesDbMin } from './schema';

/**
 * IMPORTANT: if 'import' is used, the path will be resolved to the actual file in the bundled index.mv3.ts
 * but we need the same relative path (to dist file) since the data will be replaced after the build,
 * so it should be 'require' instead of 'import'.
 */
const { rawCompaniesDb } = require('./trackers-min');

/**
 * Service for working with companies database.
 */
class CompaniesDbService {
    /**
     * Category name for unknown domains.
     *
     * @see {@link https://github.com/AdguardTeam/companiesdb/blob/6a8fbfc3bff4fdffc4c8bae30756530afc2635bd/dist/trackers.json#L15}
     */
    private static readonly UNKNOWN_CATEGORY_NAME = 'unknown';

    /**
     * Companies database.
     */
    private companiesDb: CompaniesDbMin = rawCompaniesDb;

    /**
     * Returns categories from the companiesdb data where
     * - key — numeric category id
     * - value — category name.
     *
     * @returns Categories from the companiesdb data.
     *
     * @throws Error if companies database is not loaded.
     */
    public getCompaniesDbCategories(): Record<string, string> {
        if (!this.companiesDb) {
            throw new Error('[CompaniesDbService] Companies database is not loaded');
        }

        return this.companiesDb.categories;
    }

    /**
     * Matches a URL to a tracker category id.
     *
     * List of categories ids can be found in {@link companiesDb.categories}.
     *
     * @param url Request URL to match.
     *
     * @returns Matched company category name,
     * or {@link CompaniesDbService.UNKNOWN_CATEGORY_NAME} if the category is unknown.
     */
    public match(url: string): string {
        if (!this.companiesDb || !this.companiesDb.trackerDomains) {
            return CompaniesDbService.UNKNOWN_CATEGORY_NAME;
        }

        const domain = getDomain(url);

        if (!domain) {
            return CompaniesDbService.UNKNOWN_CATEGORY_NAME;
        }

        const companyCategoryId = this.companiesDb.trackerDomains[domain];

        if (!companyCategoryId) {
            return CompaniesDbService.UNKNOWN_CATEGORY_NAME;
        }

        const companyCategoryName = this.companiesDb.categories[companyCategoryId];

        if (!companyCategoryName) {
            return CompaniesDbService.UNKNOWN_CATEGORY_NAME;
        }

        return companyCategoryName;
    }
}

export const companiesDbService = new CompaniesDbService();
