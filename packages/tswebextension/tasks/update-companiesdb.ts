/* eslint-disable @typescript-eslint/naming-convention,no-underscore-dangle */
import fs from 'node:fs';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type CompaniesDbMin } from '../src/lib/common/companies-db-service/schema';

const COMPANIES_DB_URL = 'https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/dist/trackers.json';

/**
 * Destination directory for the output file.
 */
const DEST_DIR = '../src/lib/common/companies-db-service';

/**
 * Output file name.
 */
const COMPANIES_DB_OUTPUT_FILE = 'trackers-min.ts';

// Define __filename and __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
 * Compares two companies database objects, ignoring the `timeUpdated` field.
 *
 * @param oldData Existing companies database data.
 * @param newData Newly downloaded companies database data.
 *
 * @returns True if meaningful changes exist (categories or trackerDomains differ), false otherwise.
 */
const hasMeaningfulChanges = (oldData: CompaniesDbMin, newData: CompaniesDbMin): boolean => {
    const oldCategoriesJson = JSON.stringify(oldData.categories);
    const newCategoriesJson = JSON.stringify(newData.categories);

    if (oldCategoriesJson !== newCategoriesJson) {
        return true;
    }

    const oldTrackerDomainsJson = JSON.stringify(oldData.trackerDomains);
    const newTrackerDomainsJson = JSON.stringify(newData.trackerDomains);

    return oldTrackerDomainsJson !== newTrackerDomainsJson;
};

/**
 * Extracts the companies database object from a TypeScript file.
 *
 * @param fileContent Content of the trackers-min.ts file.
 *
 * @returns Parsed companies database object, or null if parsing fails.
 */
const extractCompaniesDbFromFile = (fileContent: string): CompaniesDbMin | null => {
    try {
        const match = fileContent.match(/export const rawCompaniesDb = ({.*});/s);
        if (!match) {
            return null;
        }
        return JSON.parse(match[1]);
    } catch {
        return null;
    }
};

/**
 * Downloads companies database from AdguardTeam/companiesdb repository
 * and minifies it to a format needed for the extension.
 *
 * Compares the new data with the existing file (ignoring `timeUpdated` field).
 * Only writes the file if meaningful changes are detected.
 *
 * @see https://github.com/AdguardTeam/companiesdb
 *
 * @param dest Path to save the JSON database.
 *
 * @returns Promise that resolves to true if changes were written,
 * false if no meaningful changes.
 *
 * @throws Error if the download fails.
 */
export async function downloadCompaniesDb(dest: string): Promise<boolean> {
    // eslint-disable-next-line no-console
    console.info('Downloading companies db...');
    const res = await fetch(COMPANIES_DB_URL);
    if (!res.ok) {
        throw new Error(`Failed to download file, status code: ${res.status}`);
    }

    const data = await res.json();
    const simplifiedData = simplifyCompaniesDbTrackers(data);

    // Check if file exists and compare with new data
    if (fs.existsSync(dest)) {
        const existingContent = fs.readFileSync(dest, 'utf-8');
        const existingData = extractCompaniesDbFromFile(existingContent);

        if (existingData && !hasMeaningfulChanges(existingData, simplifiedData)) {
            // eslint-disable-next-line no-console
            console.info('No meaningful changes detected (only timeUpdated differs)');
            return false;
        }
    }

    // Write file if it doesn't exist or meaningful changes were detected
    fs.writeFileSync(dest, `export const rawCompaniesDb = ${JSON.stringify(simplifiedData, null, '\t')};\n`);
    // eslint-disable-next-line no-console
    console.info('Downloading successful, changes written');
    return true;
}

(async (): Promise<void> => {
    if (!fs.existsSync(outputDirPath)) {
        fs.mkdirSync(outputDirPath, { recursive: true });
    }

    const hasChanges = await downloadCompaniesDb(outputFilePath);
    process.exit(hasChanges ? 0 : 1);
})();
