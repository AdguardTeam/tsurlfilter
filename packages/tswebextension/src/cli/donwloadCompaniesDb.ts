import https from 'https';
import fs from 'fs';
import path from 'path';

import { type CompaniesDbMin } from '../lib/mv3/background/services/companies-db-service';

const COMPANIES_DB_URL = 'https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/dist/trackers.json';

/**
 * Tracker data in full companies-db.
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
 * Simplifies companies-db data to a minimal set of fields needed for the extension.
 *
 * @param rawData Full companies-db data.
 *
 * @returns Simplified companies-db data.
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
 * Download companies database from AdguardTeam/companiesdb repository.
 * @see https://github.com/AdguardTeam/companiesdb
 *
 * @param dest - Path to save the JSON database.
 *
 * @returns Promise that resolves when the database is downloaded.
 * @throws Error if the download fails.
 */
export function downloadCompaniesDb(dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(
            path.resolve(process.cwd(), dest),
        );

        // eslint-disable-next-line no-console
        console.info('Downloading companies db...');

        https.get(COMPANIES_DB_URL, (res) => {
            if (res.statusCode === 200) {
                res.pipe(file);

                res.on('end', () => {
                    const rawData = fs.readFileSync(dest, 'utf8');
                    const parsedData = JSON.parse(rawData);
                    const simplifiedData = simplifyCompaniesDbTrackers(parsedData);
                    fs.writeFileSync(dest, JSON.stringify(simplifiedData));
                });
            } else {
                file.emit('error', new Error(`Failed to download file, status code: ${res.statusCode}`));
            }
        }).on('error', (err) => {
            file.emit('error', err);
        });

        file.on('finish', resolve);
        file.on('error', reject);
    });
}
