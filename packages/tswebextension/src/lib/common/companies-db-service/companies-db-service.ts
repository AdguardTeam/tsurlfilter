import { getHostname, getDomain } from 'tldts';

import { type CompaniesDbMin } from './schema';
import { rawCompaniesDb } from './trackers-min';

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
     * Dot symbol.
     */
    private static readonly DOT = '.';

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
     * Recursively tries to match a company category id for a `domainToCheck`.
     *
     * If the category is not found for an input `domainToCheck`,
     * slices the first subdomain and tries to check a category for a new domain,
     * e.g. `test1.sub.example.com` -> `sub.example.com` -> `example.com`,
     * and returns the category if found.
     *
     * @param domainToCheck Domain to check.
     * @param rootDomain Root domain.
     *
     * @returns Matched company category id or `null` if not found.
     */
    private matchCompanyCategoryId(
        domainToCheck: string | null,
        rootDomain: string | null,
    ): number | null {
        if (!domainToCheck || !rootDomain) {
            return null;
        }

        if (domainToCheck === rootDomain) {
            return this.companiesDb.trackerDomains[rootDomain] || null;
        }

        const categoryId = this.companiesDb.trackerDomains[domainToCheck];

        if (!categoryId) {
            const firstDotIndex = domainToCheck.indexOf(CompaniesDbService.DOT);
            const nextDomainToCheck = domainToCheck.slice(firstDotIndex + 1);
            return this.matchCompanyCategoryId(nextDomainToCheck, rootDomain);
        }

        return categoryId;
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

        const companyCategoryId = this.matchCompanyCategoryId(
            getHostname(url),
            // getDomain with no allowPrivateDomains flag set returns root domain,
            // e.g. 'test-public.s3.amazonaws.com' -> 'amazonaws.com'
            getDomain(url),
        );

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
