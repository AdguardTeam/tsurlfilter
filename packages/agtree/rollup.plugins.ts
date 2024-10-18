import path from 'path';
import { type Plugin } from 'rollup';
import { fileURLToPath } from 'url';

import * as data from './src/compatibility-tables/compatibility-table-data';

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * A Rollup plugin that replaces imports of `compatibility-table-data.ts`
 * with inline JSON exports of compatibility data.
 *
 * @returns {Plugin} A Rollup plugin object with the `name` and `transform` hook.
 */
export function compatibilityTablePlugin(): Plugin {
    return {
        name: 'compatibility-table-plugin',

        /**
         * Transforms the target file by inlining compatibility data as JSON exports.
         *
         * @param _ Unused source code.
         * @param id file path of the module.
         * @returns Transformed code or null if no transformation is applied.
         */
        transform(_: string, id: string) {
            const targetPath = path.resolve(__dirname, 'src', 'compatibility-tables', 'compatibility-table-data.ts');

            if (id === targetPath) {
                const transformedCode = `
export const modifiersCompatibilityTableData = ${JSON.stringify(data.modifiersCompatibilityTableData)};
export const redirectsCompatibilityTableData = ${JSON.stringify(data.redirectsCompatibilityTableData)};
export const scriptletsCompatibilityTableData = ${JSON.stringify(data.scriptletsCompatibilityTableData)};
`;

                return {
                    code: transformedCode,
                    map: null,
                };
            }

            return null;
        },
    };
}
