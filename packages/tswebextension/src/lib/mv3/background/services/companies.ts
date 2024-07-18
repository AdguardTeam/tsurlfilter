import browser from "webextension-polyfill";
import { getDomain } from "tldts";
import zod from "zod";

/**
 * Schema for companies database.
 */
const companiesSchema = zod.object({
    timeUpdated: zod.string(),
    categories: zod.record(zod.string()),
    trackers: zod.record(
        zod.object({
            name: zod.string(),
            categoryId: zod.number().optional(),
            url: zod.string().or(zod.null()),
            companyId: zod.string().or(zod.null()),
            source: zod.string().optional(),
        }).strict(),
    ),
    trackerDomains: zod.record(zod.string()),
}).strict();

export type Companies = zod.infer<typeof companiesSchema>;

/**
 * Service for working with companies database.
 */
class CompaniesService {
    /**
     * Category ID for unknown domains.
     */
    private static UNKNOWN_CATEGORY = 11;

    /**
     * Companies database.
     */
    private companies?: Companies;

    /**
     * Download and validate companies database.
     * @param path Path to the companies database file.
     */
    public async loadCompanies(path: string): Promise<void> {
        const url = browser.runtime.getURL(path)
        const res = await fetch(url);

        if (!res.ok) {
            throw new Error(`Failed to load companies from ${url}`);
        }

        const json = await res.json();

        this.companies = companiesSchema.parse(json);
    }

    /**
     * Match URL to a tracker category id. if the URL is not found in the database
     * or database is not loaded, return {@link UNKNOWN_CATEGORY}.
     * 
     * list of categories ids can be found in {@link companies.categories}.
     * @param url request URL to match.
     * @returns Tracker category ID.
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

        return trackerData.categoryId ?? CompaniesService.UNKNOWN_CATEGORY
    }
}

export const companiesService = new CompaniesService();