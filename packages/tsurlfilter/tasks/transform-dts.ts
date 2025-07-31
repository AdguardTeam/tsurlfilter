/* eslint-disable jsdoc/require-description-complete-sentence */
/* eslint-disable no-console */
/**
 * @file Fixes import/export paths in generated `.d.ts` files to conform to NodeNext ESM resolution rules.
 *
 * @description
 * This script scans all `.d.ts` files in the project's output directory (`dist/types/`)
 * and rewrites their relative module specifiers to include explicit `.js` extensions,
 * as required by NodeNext-compatible consumers of this package.
 *
 * ### Specifically, it performs the following rewrites:
 * - `./foo`         → `./foo.js`       (if referring to a file)
 * - `./bar`         → `./bar/index.js` (if referring to a directory with `index.d.ts`)
 * - Leaves all non-relative or already-suffixed imports untouched
 *
 * ### Covers:
 * - `import` declarations
 * - `export` declarations
 * - `import("./x").Type` (ImportType nodes)
 *
 * This is useful for projects targeting `"module"` + `"NodeNext"` in `tsconfig.json`,
 * where `.d.ts` files must reflect the `.js` suffix used in runtime ESM.
 *
 * This way, we don’t need to include .js extensions in our .ts files,
 * since the build is handled by Rollup, and the .d.ts files are adjusted by this script.
 */

// eslint-disable-next-line import/no-extraneous-dependencies
import fs from 'node:fs';
import path from 'node:path';
import { Project, SyntaxKind } from 'ts-morph';

const RELATIVE_PATH_MARKER = '.';
const EXT_JS = '.js';
const EXT_DTS = '.d.ts';
const INDEX_BASENAME = 'index';

const INDEX_DTS = `${INDEX_BASENAME}${EXT_DTS}`;
const INDEX_JS = `${INDEX_BASENAME}${EXT_JS}`;

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = path.dirname(new URL(import.meta.url).pathname);

const project = new Project({
    skipFileDependencyResolution: true,
});

project.addSourceFilesAtPaths(path.join(__dirname, `../dist/types/**/*${EXT_DTS}`));

/**
 * Decide how (or if) to rewrite a module specifier.
 * - keeps non-relative or already-extended specifiers unchanged
 * - './foo'  → './foo.js'
 * - '../foo' → '../foo.js'
 * - './bar'  → './bar/index.js' (if ./bar/index.d.ts exists)
 *
 * @param dir Source file directory
 * @param spec Module specifier
 *
 * @returns Rewritten module specifier or null if no change is needed
 */
function rewriteSpecifier(dir: string, spec: string): string | null {
    // Ignore non-relative specifiers
    if (!spec.startsWith(RELATIVE_PATH_MARKER)) {
        return null;
    }

    if (path.extname(spec) === EXT_JS) {
        return null;
    }

    const absPath = path.resolve(dir, spec); // dist/types/.../bar
    const asDir = fs.existsSync(absPath) && fs.statSync(absPath).isDirectory();
    const hasIdx = asDir && fs.existsSync(path.join(absPath, INDEX_DTS));

    return hasIdx ? `${spec}/${INDEX_JS}` : `${spec}${EXT_JS}`;
}

for (const sf of project.getSourceFiles()) {
    const dir = path.dirname(sf.getFilePath());

    // import ... from './x'
    sf.getImportDeclarations().forEach((d) => {
        const fixed = rewriteSpecifier(dir, d.getModuleSpecifierValue());
        if (fixed) {
            d.setModuleSpecifier(fixed);
        }
    });

    // export * from './x'
    sf.getExportDeclarations().forEach((d) => {
        const spec = d.getModuleSpecifierValue();

        if (spec === undefined) {
            return;
        }

        const fixed = rewriteSpecifier(dir, spec);
        if (fixed) {
            d.setModuleSpecifier(fixed);
        }
    });

    // type Foo = import('./x').Foo
    sf.getDescendantsOfKind(SyntaxKind.ImportType).forEach((impType) => {
        const lit = impType.getArgument()?.getChildAtIndex(0)?.asKind(SyntaxKind.StringLiteral)?.getLiteralText();

        if (lit === undefined) {
            return;
        }

        const fixed = rewriteSpecifier(dir, lit);

        if (fixed) {
            impType.setArgument(fixed);
        }
    });
}

await project.save();

console.log(`✔ ${EXT_DTS} imports fixed to NodeNext module resolution`);
