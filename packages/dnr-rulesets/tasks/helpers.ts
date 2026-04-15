import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

import { VALIDATOR_DATA_FILE_NAME } from './constants';

const validatorDataSchema = z.object({
    rulesetIds: z.array(z.number().finite()),
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Loads the set of allowed filter IDs from `validator-data.json`.
 *
 * Only filters whose IDs appear in the allowlist will be downloaded and
 * included in the build. This prevents newly added filters in the
 * FiltersRegistry from leaking into older stable branches.
 *
 * @returns A `Set<number>` of allowed filter IDs, or `undefined` if the
 * data file is not found (meaning all filters should be included).
 */
export const loadAllowedFilterIds = (): Set<number> | undefined => {
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

    const allowedIds = new Set<number>(parsed.data.rulesetIds);
    console.info(`Allowlist mode enabled: ${allowedIds.size} filters allowed.`);

    return allowedIds;
};
