/**
 * Measures the transitive payload of an ESM entry point.
 *
 * Follows relative static imports and re-exports, so a shared chunk added by
 * the bundler is included even when it is not listed explicitly.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Resolves a relative import specifier to a file path.
 *
 * @param {string} fromFile File containing the import.
 * @param {string} specifier Relative import specifier.
 *
 * @returns {string} Absolute path of the imported file.
 */
const resolveImport = (fromFile, specifier) => {
    const target = path.resolve(path.dirname(fromFile), specifier);

    return path.extname(target) ? target : `${target}.js`;
};

/**
 * Measures an entry file and every relative module it imports.
 *
 * @param {string} entry Entry file path.
 *
 * @returns {number} Total size in bytes.
 */
const measure = (entry) => {
    const seen = new Set();
    const stack = [entry];
    let total = 0;

    while (stack.length > 0) {
        const file = stack.pop();
        if (seen.has(file)) {
            continue;
        }
        seen.add(file);

        if (!fs.existsSync(file)) {
            throw new Error(`Missing payload file: ${file}`);
        }

        const source = fs.readFileSync(file, 'utf8');
        total += Buffer.byteLength(source);

        const importPattern = /(?:from\s*|import\s*)['"](\.{1,2}\/[^'"]+)['"]/g;
        let match;
        while ((match = importPattern.exec(source)) !== null) {
            stack.push(resolveImport(file, match[1]));
        }
    }

    return total;
};

const entry = process.argv[2];
if (!entry) {
    console.error('Usage: node measure-payload.mjs <entry>');
    process.exit(1);
}

try {
    console.log(measure(entry));
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}
