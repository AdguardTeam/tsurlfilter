import { stringify } from 'javascript-stringify';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Plugin } from 'rollup';
// eslint-disable-next-line import/no-extraneous-dependencies

import * as data from './src/compatibility-tables/compatibility-table-data';

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * A Rollup plugin that replaces imports of `compatibility-table-data.ts`
 * with inline JSON exports of compatibility data.
 *
 * @returns A Rollup plugin object with the `name` and `transform` hook.
 */
export function compatibilityTablePlugin(): Plugin {
    return {
        name: 'compatibility-table-plugin',

        /**
         * Transforms the target file by inlining compatibility data as JSON exports.
         *
         * @param _ Unused source code.
         * @param id File path of the module.
         *
         * @returns Transformed code or null if no transformation is applied.
         */
        transform(_: string, id: string) {
            const targetPath = path.resolve(
                __dirname,
                'src',
                'compatibility-tables',
                'compatibility-table-data.ts',
            );

            if (id === targetPath) {
                const transformedCode = `
export const modifiersCompatibilityTableData = ${stringify(data.modifiersCompatibilityTableData)};
export const redirectsCompatibilityTableData = ${stringify(data.redirectsCompatibilityTableData)};
export const scriptletsCompatibilityTableData = ${stringify(data.scriptletsCompatibilityTableData)};
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
