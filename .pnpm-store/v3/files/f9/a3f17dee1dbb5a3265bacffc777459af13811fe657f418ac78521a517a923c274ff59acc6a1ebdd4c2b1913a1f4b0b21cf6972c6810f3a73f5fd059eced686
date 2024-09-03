import { type CreateNodes, type ProjectGraph, type Tree } from 'nx/src/devkit-exports';
/**
 * Iterates through various forms of plugin options to find the one which does not conflict with the current graph

 */
export declare function addPlugin<PluginOptions>(tree: Tree, graph: ProjectGraph, pluginName: string, createNodesTuple: CreateNodes<PluginOptions>, options: Partial<Record<keyof PluginOptions, PluginOptions[keyof PluginOptions][]>>, shouldUpdatePackageJsonScripts: boolean): Promise<void>;
export declare function generateCombinations<T>(input: Record<string, T[]>): Record<string, T>[];
