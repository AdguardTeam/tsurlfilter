import { type Plugin } from 'rollup';

/**
 * Extract Rollup plugins from a list of plugins by their names.
 * It extracts the plugins in the order they appear in the list.
 *
 * @param plugins The list of plugins.
 * @param names The names of the plugins to extract.
 *
 * @returns The extracted plugins.
 *
 * @throws If a plugin with the given name is not found.
 */
export const extractRollupPlugins = (plugins: Plugin[], names: string[]): Plugin[] => {
    const extractedPlugins: Plugin[] = [];

    for (const name of names) {
        const plugin = plugins.find((p) => p.name === name);

        if (!plugin) {
            throw new Error(`Plugin "${name}" not found`);
        }

        extractedPlugins.push(plugin);
    }

    return extractedPlugins;
};
