import browser from 'webextension-polyfill';
import { getDomain } from 'tldts';
import zod from 'zod';

/**
 * Schema for companies database.
 */
const companiesSchema = zod.object({
    /**
     * Date and time when the database was last updated, in ISO 8601 format.
     */
    timeUpdated: zod.string(),

    /**
     * List of categories. Object where key is numeric category ID and value is category name.
     */
    categories: zod.record(zod.string()),

    /**
     * List of trackers. Object where
     * - key — string tracker ID
     * - value — tracker data.
     *
     * @see {@link https://github.com/AdguardTeam/companiesdb/blob/6a8fbfc3bff4fdffc4c8bae30756530afc2635bd/README.md?plain=1#L85}
     */
    trackers: zod.record(
        zod.object({
            /**
             * Tracker name.
             */
            name: zod.string(),

            /**
             * Tracker category ID.
             */
            categoryId: zod.number().optional(),

            /**
             * Tracker main URL.
             */
            url: zod.string().or(zod.null()),

            /**
             * Tracker company ID.
             */
            companyId: zod.string().or(zod.null()),

            /**
             * Source of the tracker data.
             */
            source: zod.string().optional(),
        }).strict(),
    ),

    /**
     * List of tracker domains. Object where
     * - key — domain name
     * - value — tracker ID from `trackers`.
     */
    trackerDomains: zod.record(zod.string()),
}).strict();

export type Companies = zod.infer<typeof companiesSchema>;

/**
 * Service for working with companies database.
 */
class CompaniesService {
    /**
     * Category ID for unknown domains.
     *
     * @see {@link https://github.com/AdguardTeam/companiesdb/blob/6a8fbfc3bff4fdffc4c8bae30756530afc2635bd/dist/trackers.json#L15}
     */
    private static UNKNOWN_CATEGORY = 11;

    /**
     * Companies database.
     */
    private companies?: Companies;

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

        this.companies = companiesSchema.parse(json);
    }

    /**
     * Matches a URL to a tracker category id.
     *
     * List of categories ids can be found in {@link companies.categories}.
     *
     * @param url Request URL to match.
     *
     * @returns Actual tracker category ID or {@link UNKNOWN_CATEGORY} if not found or database is not loaded.
     */
    public match(url: string): number {
        if (!this.companies) {
            return CompaniesService.UNKNOWN_CATEGORY;
        }

        const domain = getDomain(url);

        if (!domain) {
            return CompaniesService.UNKNOWN_CATEGORY;
        }

        const tracker = this.companies.trackerDomains[domain];

        if (!tracker) {
            return CompaniesService.UNKNOWN_CATEGORY;
        }

        const trackerData = this.companies.trackers[tracker];

        if (!trackerData) {
            return CompaniesService.UNKNOWN_CATEGORY;
        }

        return trackerData.categoryId ?? CompaniesService.UNKNOWN_CATEGORY;
    }
}

export const companiesService = new CompaniesService();
