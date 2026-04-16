import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

import { type BrowserFilters } from '../common/constants';
import { VALIDATOR_DATA_FILE_NAME } from './constants';

const browserDataSchema = z.object({
    rulesetIds: z.array(z.number().finite()),
});

const validatorDataSchema = z.record(z.string(), browserDataSchema);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Loads the set of allowed filter IDs for the given browser from
 * `validator-data.json`.
 *
 * Only filters whose IDs appear in the allowlist will be downloaded and
 * included in the build. This prevents newly added filters in the
 * FiltersRegistry from leaking into older stable branches.
 *
 * @param browser Browser to load allowed filter IDs for.
 *
 * @returns A `Set<number>` of allowed filter IDs, or `undefined` if the
 * data file is not found (meaning all filters should be included).
 */
export const loadAllowedFilterIds = (browser: BrowserFilters): Set<number> | undefined => {
    const dataPath = path.join(__dirname, VALIDATOR_DATA_FILE_NAME);

    let raw: string;
    try {
        raw = fs.readFileSync(dataPath, 'utf-8');
    } catch {
        console.warn(
            `Warning: ${VALIDATOR_DATA_FILE_NAME} not found at ${dataPath},`
            + ' skipping allowlist filtering.',
        );
        return undefined;
    }

    const parsed = validatorDataSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
        throw new Error(
            `Invalid ${VALIDATOR_DATA_FILE_NAME}: ${parsed.error.message}`,
        );
    }

    const browserData = parsed.data[browser];
    if (!browserData) {
        throw new Error(`Invalid ${VALIDATOR_DATA_FILE_NAME}: missing entry for ${browser}`);
    }

    const allowedIds = new Set<number>(browserData.rulesetIds);
    console.info(`Allowlist mode enabled for ${browser}: ${allowedIds.size} filters allowed.`);

    return allowedIds;
};
