"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCreateNodesInParallel = exports.normalizeNxPlugin = exports.isNxPluginV1 = exports.isNxPluginV2 = void 0;
const node_path_1 = require("node:path");
const workspaces_1 = require("../../config/workspaces");
const globs_1 = require("../../utils/globs");
const error_types_1 = require("../error-types");
function isNxPluginV2(plugin) {
    return 'createNodes' in plugin || 'createDependencies' in plugin;
}
exports.isNxPluginV2 = isNxPluginV2;
function isNxPluginV1(plugin) {
    return 'processProjectGraph' in plugin || 'projectFilePatterns' in plugin;
}
exports.isNxPluginV1 = isNxPluginV1;
function normalizeNxPlugin(plugin) {
    if (isNxPluginV2(plugin)) {
        return plugin;
    }
    if (isNxPluginV1(plugin) && plugin.projectFilePatterns) {
        return {
            ...plugin,
            createNodes: [
                `*/**/${(0, globs_1.combineGlobPatterns)(plugin.projectFilePatterns)}`,
                (configFilePath) => {
                    const root = (0, node_path_1.dirname)(configFilePath);
                    return {
                        projects: {
                            [root]: {
                                name: (0, workspaces_1.toProjectName)(configFilePath),
                                targets: plugin.registerProjectTargets?.(configFilePath),
                            },
                        },
                    };
                },
            ],
        };
    }
    return plugin;
}
exports.normalizeNxPlugin = normalizeNxPlugin;
async function runCreateNodesInParallel(configFiles, plugin, options, context) {
    performance.mark(`${plugin.name}:createNodes - start`);
    const errors = [];
    const results = [];
    const promises = configFiles.map(async (file) => {
        performance.mark(`${plugin.name}:createNodes:${file} - start`);
        try {
            const value = await plugin.createNodes[1](file, options, context);
            if (value) {
                results.push({
                    ...value,
                    file,
                    pluginName: plugin.name,
                });
            }
        }
        catch (e) {
            errors.push(new error_types_1.CreateNodesError({
                error: e,
                pluginName: plugin.name,
                file,
            }));
        }
        finally {
            performance.mark(`${plugin.name}:createNodes:${file} - end`);
            performance.measure(`${plugin.name}:createNodes:${file}`, `${plugin.name}:createNodes:${file} - start`, `${plugin.name}:createNodes:${file} - end`);
        }
    });
    await Promise.all(promises).then(() => {
        performance.mark(`${plugin.name}:createNodes - end`);
        performance.measure(`${plugin.name}:createNodes`, `${plugin.name}:createNodes - start`, `${plugin.name}:createNodes - end`);
    });
    if (errors.length > 0) {
        throw new error_types_1.AggregateCreateNodesError(plugin.name, errors, results);
    }
    return results;
}
exports.runCreateNodesInParallel = runCreateNodesInParallel;
