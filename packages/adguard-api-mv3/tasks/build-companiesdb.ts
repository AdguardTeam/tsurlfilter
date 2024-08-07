/**
 * @file
 * This file is part of Adguard API library (https://github.com/AdguardTeam/tsurlfilter/packages/adguard-api).
 *
 * Adguard API is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Adguard API is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adguard API. If not, see <http://www.gnu.org/licenses/>.
 */

import path from 'path';

import { downloadCompaniesDb } from '@adguard/tswebextension/cli';

import { distDirPath } from './constants';

const COMPANIES_DB_FILENAME = 'trackers.json';

const companiesDbFileOutputPath = path.resolve(distDirPath, COMPANIES_DB_FILENAME);

/**
 * Builds companies db and saves it to the dist directory.
 */
const buildCompaniesDb = async (): Promise<void> => {
    try {
        await downloadCompaniesDb(companiesDbFileOutputPath);
    } catch (e) {
        // eslint-disable-next-line no-console
        console.log(e);
        process.exit(1);
    }
};

(async (): Promise<void> => {
    await buildCompaniesDb();
})();
