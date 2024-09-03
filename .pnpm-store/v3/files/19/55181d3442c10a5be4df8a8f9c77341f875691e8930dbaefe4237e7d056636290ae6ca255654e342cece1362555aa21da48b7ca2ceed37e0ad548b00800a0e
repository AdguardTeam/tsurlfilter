import { CreateNodesResultWithContext } from './plugins/internal-api';
import { ConfigurationResult, ConfigurationSourceMaps } from './utils/project-configuration-utils';
import { ProjectConfiguration } from '../config/workspace-json-project-json';
import { ProcessDependenciesError, ProcessProjectGraphError } from './build-project-graph';
import { ProjectGraph } from '../config/project-graph';
export declare class ProjectGraphError extends Error {
    #private;
    constructor(errors: Array<CreateNodesError | MergeNodesError | ProjectsWithNoNameError | ProjectsWithConflictingNamesError | ProcessDependenciesError | ProcessProjectGraphError>, partialProjectGraph: ProjectGraph, partialSourceMaps: ConfigurationSourceMaps);
    /**
     * The daemon cannot throw errors which contain methods as they are not serializable.
     *
     * This method creates a new {@link ProjectGraphError} from a {@link DaemonProjectGraphError} with the methods based on the same serialized data.
     */
    static fromDaemonProjectGraphError(e: DaemonProjectGraphError): ProjectGraphError;
    /**
     * This gets the partial project graph despite the errors which occured.
     * This partial project graph may be missing nodes, properties of nodes, or dependencies.
     * This is useful mostly for visualization/debugging. It should not be used for running tasks.
     */
    getPartialProjectGraph(): ProjectGraph;
    getPartialSourcemaps(): ConfigurationSourceMaps;
    getErrors(): (ProcessDependenciesError | ProcessProjectGraphError | CreateNodesError | MergeNodesError | ProjectsWithNoNameError | ProjectsWithConflictingNamesError)[];
}
export declare class ProjectsWithConflictingNamesError extends Error {
    projects: Record<string, ProjectConfiguration>;
    constructor(conflicts: Map<string, string[]>, projects: Record<string, ProjectConfiguration>);
}
export declare function isProjectsWithConflictingNamesError(e: unknown): e is ProjectsWithConflictingNamesError;
export declare class ProjectsWithNoNameError extends Error {
    projects: Record<string, ProjectConfiguration>;
    constructor(projectRoots: string[], projects: Record<string, ProjectConfiguration>);
}
export declare function isProjectsWithNoNameError(e: unknown): e is ProjectsWithNoNameError;
export declare class ProjectConfigurationsError extends Error {
    readonly errors: Array<MergeNodesError | CreateNodesError | ProjectsWithNoNameError | ProjectsWithConflictingNamesError>;
    readonly partialProjectConfigurationsResult: ConfigurationResult;
    constructor(errors: Array<MergeNodesError | CreateNodesError | ProjectsWithNoNameError | ProjectsWithConflictingNamesError>, partialProjectConfigurationsResult: ConfigurationResult);
}
export declare class CreateNodesError extends Error {
    file: string;
    pluginName: string;
    constructor({ file, pluginName, error, }: {
        file: string;
        pluginName: string;
        error: Error;
    });
}
export declare class AggregateCreateNodesError extends Error {
    readonly pluginName: string;
    readonly errors: Array<CreateNodesError>;
    readonly partialResults: Array<CreateNodesResultWithContext>;
    constructor(pluginName: string, errors: Array<CreateNodesError>, partialResults: Array<CreateNodesResultWithContext>);
}
export declare class MergeNodesError extends Error {
    file: string;
    pluginName: string;
    constructor({ file, pluginName, error, }: {
        file: string;
        pluginName: string;
        error: Error;
    });
}
export declare function isCreateNodesError(e: unknown): e is CreateNodesError;
export declare function isAggregateCreateNodesError(e: unknown): e is AggregateCreateNodesError;
export declare function isMergeNodesError(e: unknown): e is MergeNodesError;
export declare class DaemonProjectGraphError extends Error {
    errors: any[];
    readonly projectGraph: ProjectGraph;
    readonly sourceMaps: ConfigurationSourceMaps;
    constructor(errors: any[], projectGraph: ProjectGraph, sourceMaps: ConfigurationSourceMaps);
}
export declare class LoadPluginError extends Error {
    plugin: string;
    constructor(plugin: string, cause: Error);
}
