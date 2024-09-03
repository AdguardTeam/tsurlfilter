import { PluginConfiguration } from '../../config/nx-json';
import { NxPluginV1 } from '../../utils/nx-plugin.deprecated';
import { CreateDependencies, CreateDependenciesContext, CreateNodesContext, CreateNodesResult, NxPluginV2 } from './public-api';
import { ProjectGraphProcessor } from '../../config/project-graph';
export declare class LoadedNxPlugin {
    readonly name: string;
    readonly createNodes?: [
        filePattern: string,
        fn: (matchedFiles: string[], context: CreateNodesContext) => Promise<CreateNodesResultWithContext[]>
    ];
    readonly createDependencies?: (context: CreateDependenciesContext) => ReturnType<CreateDependencies>;
    readonly processProjectGraph?: ProjectGraphProcessor;
    readonly options?: unknown;
    readonly include?: string[];
    readonly exclude?: string[];
    constructor(plugin: NormalizedPlugin, pluginDefinition: PluginConfiguration);
}
export type CreateNodesResultWithContext = CreateNodesResult & {
    file: string;
    pluginName: string;
};
export type NormalizedPlugin = NxPluginV2 & Pick<NxPluginV1, 'processProjectGraph'>;
export declare const nxPluginCache: Map<unknown, [
    Promise<LoadedNxPlugin>,
    () => void
]>;
export declare function loadNxPlugins(plugins: PluginConfiguration[], root?: string): Promise<[LoadedNxPlugin[], () => void]>;
export declare function getDefaultPlugins(root: string): Promise<string[]>;
