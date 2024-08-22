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
     * - key — numeric category id
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

/**
 * Minimal companies database data with simplified structure.
 */
export type CompaniesDbMin = zod.infer<typeof companiesDbMinSchema>;
