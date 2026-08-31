import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { type Plugin } from 'rollup';

import * as data from './src/compatibility-tables/compatibility-table-data';
import type { CompatibilityTable, HybridCompatibilityTableRow } from './src/compatibility-tables/types';

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Compact serialized format for a single compatibility table row.
 * Data objects are stored once in `shared`, referenced by index elsewhere.
 */
interface CompactRow<T> {
    /**
     * Unique data objects for this feature.
     */
    shared: T[];
    /**
     * Platform string → index into shared array.
     */
    flatMap: Array<[string, number]>;
}

/**
 * Compact serialized format for an entire compatibility table.
 * Rows are stored once in an array; name→row uses indices.
 */
interface CompactTable<T> {
    /**
     * Unique rows (deduplicated across aliases).
     */
    rows: Array<CompactRow<T>>;
    /**
     * Name → index into rows array.
     */
    names: Array<[string, number]>;
}

/**
 * Converts a CompatibilityTable to a compact JSON-serializable format.
 *
 * Optimizations vs native serialization:
 * - Data objects stored once in `shared`, referenced by index (eliminates ~20x duplication).
 * - Trie is not serialized — rebuilt at runtime from flatMap (eliminates ~50% of data).
 * - Aliased names share the same row index (eliminates ~3x row duplication).
 *
 * @param table Compatibility table with Maps and TrieNodes.
 *
 * @returns Compact serializable table.
 */
function serializeCompact<T>(table: CompatibilityTable<T>): CompactTable<T> {
    const rowMap = new Map<HybridCompatibilityTableRow<T>, number>();
    const rows: Array<CompactRow<T>> = [];
    const names: Array<[string, number]> = [];

    for (const [name, row] of table.rows.entries()) {
        // Deduplicate rows (aliases point to the same row object)
        let rowIndex = rowMap.get(row);

        if (rowIndex === undefined) {
            // Build an identity map from data object → index in shared
            const dataToIndex = new Map<T, number>();
            for (let i = 0; i < row.shared.length; i += 1) {
                dataToIndex.set(row.shared[i], i);
            }

            // Build compact flatMap: [platformString, sharedIndex]
            const compactFlatMap: Array<[string, number]> = [];
            for (const [platformStr, dataObj] of row.flatMap.entries()) {
                const idx = dataToIndex.get(dataObj);
                if (idx === undefined) {
                    throw new Error(
                        `serializeCompact: flatMap entry for platform '${platformStr}' references `
                        + 'a data object that is not present in row.shared. This indicates a bug '
                        + 'in the compatibility table loader.',
                    );
                }
                compactFlatMap.push([platformStr, idx]);
            }

            rowIndex = rows.length;
            rows.push({
                shared: row.shared,
                flatMap: compactFlatMap,
            });
            rowMap.set(row, rowIndex);
        }

        names.push([name, rowIndex]);
    }

    return { rows, names };
}

/**
 * Generates the code for a single compatibility data module.
 * Uses JSON.parse() for faster V8 parsing compared to JS object literals.
 *
 * @param varName Variable name for the export (e.g. 'modifiersCompatibilityTableData').
 * @param jsonData Compact serialized compatibility table data.
 *
 * @returns Transformed module code string.
 */
function generateDataModuleCode<T>(varName: string, jsonData: CompactTable<T>): string {
    // Double-stringify: inner stringify creates the JSON string,
    // outer stringify creates a valid JS string literal for it.
    // This makes V8 use its fast JSON parser instead of the JS parser.
    const jsonString = JSON.stringify(JSON.stringify(jsonData));

    return `
import { TrieNode } from './trie';

const PLATFORM_SEPARATOR = '_';

/**
 * Builds a trie from flatMap entries by parsing platform strings into paths.
 *
 * Trie is not serialized into the compact format (it would duplicate all data).
 * Instead it is rebuilt at runtime from the flatMap, which already holds the
 * canonical platform-string → data-object mapping. Splitting on '_' recovers
 * the path segments (e.g. 'adg_os_windows' → ['adg', 'os', 'windows']) that
 * TrieNode.insert() expects — the same convention used by Platform.toPath().
 *
 * @param flatMap Map of platform strings to data objects.
 * @returns Populated TrieNode.
 */
function buildTrie(flatMap) {
    const trie = new TrieNode();
    for (const [platformStr, dataObj] of flatMap.entries()) {
        const path = platformStr.split(PLATFORM_SEPARATOR);
        trie.insert(path, dataObj);
    }
    return trie;
}

/**
 * Deserializes compact compatibility table data.
 * Rebuilds Maps and TrieNodes from the compact index-based format.
 *
 * @param json Compact serialized table.
 * @returns Deserialized compatibility table with Maps and TrieNodes.
 */
function deserialize(json) {
    // First, rebuild all unique rows
    const deserializedRows = new Array(json.rows.length);
    for (let i = 0; i < json.rows.length; i++) {
        const compactRow = json.rows[i];
        const shared = compactRow.shared;

        // Rebuild flatMap: [platformStr, sharedIndex] → Map<string, T>
        const flatMap = new Map();
        for (const [platformStr, sharedIdx] of compactRow.flatMap) {
            flatMap.set(platformStr, shared[sharedIdx]);
        }

        // Rebuild trie from flatMap (trie is not serialized to avoid duplicating data).
        // Platform strings like 'adg_os_windows' are split on '_' to recover
        // the path segments expected by TrieNode, matching Platform.toPath().
        const trie = buildTrie(flatMap);

        // Freeze the row container to preserve the immutability contract.
        // Shallow freeze is sufficient: prevents property reassignment on the
        // row object itself without the O(n) cost of recursively freezing all
        // data objects (which is safe to skip since data is private and
        // read-only through the public CompatibilityTableBase API).
        deserializedRows[i] = Object.freeze({ trie, flatMap, shared });
    }

    // Rebuild name → row mapping (aliases share the same row object)
    const rows = new Map();
    for (const [name, rowIdx] of json.names) {
        rows.set(name, deserializedRows[rowIdx]);
    }

    return Object.freeze({ rows });
}

// Parse JSON data — JSON.parse() is significantly faster than JS object literals for large data
const dataJSON = JSON.parse(${jsonString});

// Lazy deserialization cache
let cache = null;

// Wrapper object with lazy getter
const wrapper = {
    get rows() {
        if (!cache) {
            cache = deserialize(dataJSON);
        }
        return cache.rows;
    }
};

export const ${varName} = wrapper;
`;
}

/**
 * Mapping of compatibility data file names to their data source and export variable name.
 */
const COMPATIBILITY_DATA_FILES: Record<string, {
    getData: () => CompatibilityTable<unknown>;
    varName: string;
}> = {
    'modifiers-compatibility-table-data.ts': {
        getData: () => data.modifiersCompatibilityTableData,
        varName: 'modifiersCompatibilityTableData',
    },
    'redirects-compatibility-table-data.ts': {
        getData: () => data.redirectsCompatibilityTableData,
        varName: 'redirectsCompatibilityTableData',
    },
    'scriptlets-compatibility-table-data.ts': {
        getData: () => data.scriptletsCompatibilityTableData,
        varName: 'scriptletsCompatibilityTableData',
    },
};

/**
 * A Rollup plugin that replaces imports of individual compatibility data files
 * with inline JSON exports. Each data file is replaced independently so that
 * only the data actually imported gets loaded at runtime.
 *
 * Uses a compact serialization format that eliminates data duplication
 * (index-based references instead of copies) and omits the trie (rebuilt
 * at runtime from the flat map). Combined with JSON.parse() for fast V8
 * parsing, this reduces serialized size by ~90% compared to native serialization.
 *
 * @returns A Rollup plugin object with the `name` and `transform` hook.
 */
export function compatibilityTablePlugin(): Plugin {
    const tablesDir = path.resolve(__dirname, 'src', 'compatibility-tables');

    return {
        name: 'compatibility-table-plugin',

        /**
         * Transforms compatibility data files by inlining serialized data.
         *
         * @param _ Unused source code.
         * @param id File path of the module.
         *
         * @returns Transformed code or null if no transformation is applied.
         */
        transform(_: string, id: string) {
            for (const [fileName, config] of Object.entries(COMPATIBILITY_DATA_FILES)) {
                const targetPath = path.resolve(tablesDir, fileName);

                if (id !== targetPath) {
                    continue;
                }

                const tableData = config.getData();
                const serialized = serializeCompact(tableData);
                const code = generateDataModuleCode(config.varName, serialized);

                return { code, map: null };
            }

            return null;
        },
    };
}
