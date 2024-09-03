import path from 'node:path';
import fs from 'node:fs/promises';
import { builtinModules } from 'node:module';
// Prepare node built-in modules lists.
// Note: node:test is currently not part of builtinModules... and may well never be
// (see https://github.com/nodejs/node/issues/42785)
const nodePrefix = 'node:';
const nodePrefixRx = /^node:/;
const builtins = {
    all: new Set(builtinModules),
    alwaysPrefixed: new Set(builtinModules.filter(mod => nodePrefixRx.test(mod)))
};
for (const extra of ['node:test']) {
    builtins.all.add(extra);
    builtins.alwaysPrefixed.add(extra);
}
// Files that mark the root of a workspace.
const workspaceRootFiles = new Set([
    'pnpm-workspace.yaml',
    'lerna.json', // Lerna
    // Note: is there any interest in the following?
    // 'workspace.jsonc',      // Bit
    // 'nx.json',              // Nx
    // 'rush.json',            // Rush
]);
const defaults = {
    builtins: true,
    builtinsPrefix: 'add',
    packagePath: [],
    deps: true,
    devDeps: false,
    peerDeps: true,
    optDeps: true,
    include: [],
    exclude: []
};
const isString = (str) => typeof str === 'string' && str.length > 0;
/**
 * A Rollup plugin that automatically declares NodeJS built-in modules,
 * and optionally npm dependencies, as 'external'.
 */
function nodeExternals(options = {}) {
    const config = { ...defaults, ...options };
    let include, exclude;
    const isIncluded = (id) => include.some(rx => rx.test(id)), isExcluded = (id) => exclude.some(rx => rx.test(id));
    return {
        name: 'node-externals',
        async buildStart() {
            // Map the include and exclude options to arrays of regexes.
            [include, exclude] = ['include', 'exclude'].map(option => []
                .concat(config[option])
                .reduce((result, entry, index) => {
                if (entry instanceof RegExp)
                    result.push(entry);
                else if (isString(entry))
                    result.push(new RegExp('^' + entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
                else if (entry) {
                    this.warn(`Ignoring wrong entry type #${index} in '${option}' option: ${JSON.stringify(entry)}`);
                }
                return result;
            }, []));
            // Populate the packagePath option if not given by getting all package.json files
            // from cwd up to the root of the git repo, the root of the monorepo,
            // or the root of the volume, whichever comes first.
            const packagePaths = []
                .concat(config['packagePath'])
                .filter(isString);
            if (packagePaths.length === 0) {
                for (let current = process.cwd(), previous; previous !== current; previous = current, current = path.dirname(current)) {
                    const entries = await fs.readdir(current, { withFileTypes: true });
                    // Gather package.json files.
                    if (entries.some(entry => entry.name === 'package.json' && entry.isFile()))
                        packagePaths.push(path.join(current, 'package.json'));
                    // Break early if this is a git repo root or there is a known workspace root file.
                    if (entries.some(entry => (entry.name === '.git' && entry.isDirectory())
                        || (workspaceRootFiles.has(entry.name) && entry.isFile()))) {
                        break;
                    }
                }
            }
            // Gather dependencies names.
            const dependencies = {};
            for (const packagePath of packagePaths) {
                try {
                    const json = (await fs.readFile(packagePath)).toString();
                    try {
                        const pkg = JSON.parse(json);
                        Object.assign(dependencies, config.deps ? pkg.dependencies : undefined, config.devDeps ? pkg.devDependencies : undefined, config.peerDeps ? pkg.peerDependencies : undefined, config.optDeps ? pkg.optionalDependencies : undefined);
                        this.addWatchFile(packagePath);
                        // Break early if this is a npm/yarn workspace root.
                        if ('workspaces' in pkg)
                            break;
                    }
                    catch {
                        this.error({
                            message: `File ${JSON.stringify(packagePath)} does not look like a valid package.json file.`,
                            stack: undefined
                        });
                    }
                }
                catch {
                    this.error({
                        message: `Cannot read file ${JSON.stringify(packagePath)}`,
                        stack: undefined
                    });
                }
            }
            const names = Object.keys(dependencies);
            if (names.length > 0)
                include.push(new RegExp('^(?:' + names.join('|') + ')(?:/.+)?$'));
        },
        async resolveId(id) {
            // Ignore already resolved ids, relative imports and virtual modules.
            if (/^(?:\0|\.{0,2}\/)/.test(id) || path.isAbsolute(id))
                return null;
            // Handle node builtins.
            if (id.startsWith(nodePrefix) || builtins.all.has(id)) {
                const stripped = id.replace(nodePrefixRx, '');
                return {
                    id: config.builtinsPrefix === 'ignore'
                        ? id
                        : config.builtinsPrefix === 'add' || builtins.alwaysPrefixed.has(id)
                            ? nodePrefix + stripped
                            : stripped,
                    external: (config.builtins || isIncluded(id)) && !isExcluded(id),
                    moduleSideEffects: false
                };
            }
            // Handle npm dependencies.
            return isIncluded(id) && !isExcluded(id)
                ? false // external
                : null; // normal handling
        }
    };
}
export default nodeExternals;
export { nodeExternals, // Named export since 6.1
nodeExternals as externals // For backwards compatibility
 };
//# sourceMappingURL=index.js.map