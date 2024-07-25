import browser from 'webextension-polyfill';
import { getDomain } from 'tldts';
import zod from 'zod';

/**
 * Schema for minimal companies database.
 */
const companiesDbMinSchema = zod.object({
    /**
     * Date and time when the database was last updated, in ISO 8601 format.
     */
    timeUpdated: zod.string(),

    /**
     * List of categories. Object where
     * - key — numeric category ID
     * - value — category name.
     */
    categories: zod.record(zod.string()),

    /**
     * List of tracker domains. Object where
     * - key — domain name
     * - value — category ID.
     */
    trackerDomains: zod.record(zod.string(), zod.number().or(zod.undefined())),
}).strict();

export type CompaniesDbMin = zod.infer<typeof companiesDbMinSchema>;

/**
 * Service for working with companies database.
 */
class CompaniesDbService {
    /**
     * Category ID for unknown domains.
     *
     * @see {@link https://github.com/AdguardTeam/companiesdb/blob/6a8fbfc3bff4fdffc4c8bae30756530afc2635bd/dist/trackers.json#L15}
     */
    private static UNKNOWN_CATEGORY = 11;

    /**
     * Companies database.
     */
    private companiesDb?: CompaniesDbMin;

    // FIXME(Slava): remove if not used
    // private categories: Record<string, number> | null = null;

    /**
     * Downloads and validates companies database.
     *
     * @param path Path to the companies database file.
     */
    public async loadCompanies(path: string): Promise<void> {
        const url = browser.runtime.getURL(path);
        const res = await fetch(url);

        if (!res.ok) {
            throw new Error(`Failed to load companies from ${url}`);
        }

        const json = await res.json();

        this.companiesDb = companiesDbMinSchema.parse(json);
    }

    /**
     * Matches a URL to a tracker category id.
     *
     * List of categories ids can be found in {@link companiesDb.categories}.
     *
     * @param url Request URL to match.
     *
     * @returns Actual tracker category ID or {@link UNKNOWN_CATEGORY} if not found or database is not loaded.
     */
    public match(url: string): number {
        if (!this.companiesDb) {
            return CompaniesDbService.UNKNOWN_CATEGORY;
        }

        const domain = getDomain(url);

        if (!domain) {
            return CompaniesDbService.UNKNOWN_CATEGORY;
        }

        const categoryId = this.companiesDb.trackerDomains[domain];

        return categoryId ?? CompaniesDbService.UNKNOWN_CATEGORY;
    }
}

export const companiesDbService = new CompaniesDbService();
