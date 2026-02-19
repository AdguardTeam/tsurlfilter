import path from 'path';
import { type Plugin } from 'rollup';
import { fileURLToPath } from 'url';

import * as data from './src/compatibility-tables/compatibility-table-data';
import type { CompatibilityTable, SerializableCompatibilityTable } from './src/compatibility-tables/types';

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Converts a CompatibilityTable to a JSON-serializable format.
 *
 * @param table Compatibility table with Maps and TrieNodes.
 * @returns Serializable compatibility table.
 */
function serializeCompatibilityTable<T>(table: CompatibilityTable<T>): SerializableCompatibilityTable<T> {
    const rows: Array<[string, {
        trie: unknown;
        flatMap: Array<[string, T]>;
        shared: T[];
    }]> = [];

    for (const [name, row] of table.rows.entries()) {
        rows.push([
            name,
            {
                trie: row.trie.toJSON(),
                flatMap: Array.from(row.flatMap.entries()),
                shared: row.shared,
            },
        ]);
    }

    return { rows };
}

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
                // Serialize to JSON-compatible format
                const modifiersJSON = serializeCompatibilityTable(data.modifiersCompatibilityTableData);
                const redirectsJSON = serializeCompatibilityTable(data.redirectsCompatibilityTableData);
                const scriptletsJSON = serializeCompatibilityTable(data.scriptletsCompatibilityTableData);

                const transformedCode = `
import { TrieNode } from './trie';

/**
 * Deserializes compatibility table data from JSON format.
 * Converts arrays back to Maps and reconstructs TrieNodes.
 *
 * @param json Serialized compatibility table.
 * @returns Deserialized compatibility table with Maps and TrieNodes.
 */
function deserializeCompatibilityTable(json) {
    const rows = new Map();
    
    for (const [name, row] of json.rows) {
        rows.set(name, {
            trie: TrieNode.fromJSON(row.trie),
            flatMap: new Map(row.flatMap),
            shared: row.shared,
        });
    }
    
    return { rows };
}

// JSON data stored as constants
const modifiersJSON = ${JSON.stringify(modifiersJSON)};
const redirectsJSON = ${JSON.stringify(redirectsJSON)};
const scriptletsJSON = ${JSON.stringify(scriptletsJSON)};

// Lazy deserialization caches
let modifiersCache = null;
let redirectsCache = null;
let scriptletsCache = null;

// Wrapper objects with lazy getters
const modifiersWrapper = {
    get rows() {
        if (!modifiersCache) {
            modifiersCache = deserializeCompatibilityTable(modifiersJSON);
        }
        return modifiersCache.rows;
    }
};

const redirectsWrapper = {
    get rows() {
        if (!redirectsCache) {
            redirectsCache = deserializeCompatibilityTable(redirectsJSON);
        }
        return redirectsCache.rows;
    }
};

const scriptletsWrapper = {
    get rows() {
        if (!scriptletsCache) {
            scriptletsCache = deserializeCompatibilityTable(scriptletsJSON);
        }
        return scriptletsCache.rows;
    }
};

export const modifiersCompatibilityTableData = modifiersWrapper;
export const redirectsCompatibilityTableData = redirectsWrapper;
export const scriptletsCompatibilityTableData = scriptletsWrapper;
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
