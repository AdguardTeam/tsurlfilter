import https from 'https';
import fs from 'fs';
import path from 'path';

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

        https.get('https://raw.githubusercontent.com/AdguardTeam/companiesdb/main/dist/trackers.json', (res) => {
            if (res.statusCode === 200) {
                res.pipe(file);
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
