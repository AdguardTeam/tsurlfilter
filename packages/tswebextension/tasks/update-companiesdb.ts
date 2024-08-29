import fs from 'fs';
import path from 'path';

import { type CompaniesDbMin } from '../src/lib/common/companies-db-service/schema';

const COMPANIES_DB_URL = 'https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/dist/trackers.json';

/**
 * Destination directory for the output file.
 */
const DEST_DIR = '../src/lib/common/companies-db-service';

/**
 * Output file name.
 */
const COMPANIES_DB_OUTPUT_FILE = 'trackers-min.js';

const outputDirPath = path.resolve(__dirname, DEST_DIR);
const outputFilePath = path.resolve(outputDirPath, COMPANIES_DB_OUTPUT_FILE);

/**
 * Tracker data in full companiesdb.
 */
type TrackersData = {
    /**
     * Tracker name.
     */
    name: string;

    /**
     * Tracker category ID.
     */
    categoryId?: number;

    /**
     * Tracker main URL.
     */
    url?: string;

    /**
     * Tracker company ID.
     */
    companyId?: string;

    /**
     * Source of the tracker data.
     */
    source?: string;
};

/**
 * Companies-db full data.
 */
type CompaniesDbTrackers = {
    /**
     * Date and time when the database was last updated, in ISO 8601 format.
     */
    timeUpdated: string;

    /**
     * List of categories. Object where
     * - key — numeric category ID
     * - value — category name.
     */
    categories: Record<string, string>;

    /**
     * List of trackers. Object where
     * - key — string tracker ID
     * - value — tracker data.
     *
     * @see {@link https://github.com/AdguardTeam/companiesdb/blob/6a8fbfc3bff4fdffc4c8bae30756530afc2635bd/README.md?plain=1#L85}
     */
    trackers: Record<string, TrackersData>;

    /**
     * List of tracker domains. Object where
     * - key — domain name
     * - value — tracker ID from `trackers`.
     */
    trackerDomains: Record<string, string>;
};

/**
 * Simplifies companiesdb data to a minimal set of fields needed for the extension.
 *
 * @param rawData Full companiesdb data.
 *
 * @returns Simplified companiesdb data.
 */
const simplifyCompaniesDbTrackers = (rawData: CompaniesDbTrackers): CompaniesDbMin => {
    const { trackerDomains } = rawData;

    const newTrackerDomains: Record<string, number | undefined> = {};

    Object.keys(trackerDomains).forEach((domain) => {
        const trackerId = trackerDomains[domain];
        const { categoryId } = rawData.trackers[trackerId];
        newTrackerDomains[domain] = categoryId;
    });

    return {
        timeUpdated: rawData.timeUpdated,
        categories: rawData.categories,
        trackerDomains: newTrackerDomains,
    };
};

/**
 * Downloads companies database from AdguardTeam/companiesdb repository
 * and minifies it to a format needed for the extension.
 *
 * @see https://github.com/AdguardTeam/companiesdb
 *
 * @param dest Path to save the JSON database.
 *
 * @returns Promise that resolves when the database is downloaded.
 * @throws Error if the download fails.
 */
export async function downloadCompaniesDb(dest: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.info('Downloading companies db...');
    const res = await fetch(COMPANIES_DB_URL);
    if (res.ok) {
        const data = await res.json();
        const simplifiedData = simplifyCompaniesDbTrackers(data);
        fs.writeFileSync(dest, `export const rawCompaniesDb = ${JSON.stringify(simplifiedData, null, '\t')};\n`);
    } else {
        throw new Error(`Failed to download file, status code: ${res.status}`);
    }
    // eslint-disable-next-line no-console
    console.info('Downloading successful');
}

(async (): Promise<void> => {
    if (!fs.existsSync(outputDirPath)) {
        fs.mkdirSync(outputDirPath);
    }

    await downloadCompaniesDb(outputFilePath);
})();
