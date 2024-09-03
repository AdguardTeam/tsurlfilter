import { FileData } from './file-utils';
import { FileMapCache } from './nx-deps-cache';
import { LoadedNxPlugin } from './plugins/internal-api';
import { FileMap, ProjectGraph, ProjectGraphExternalNode } from '../config/project-graph';
import { ProjectConfiguration } from '../config/workspace-json-project-json';
import { NxWorkspaceFilesExternals } from '../native';
export declare function getFileMap(): {
    fileMap: FileMap;
    allWorkspaceFiles: FileData[];
    rustReferences: NxWorkspaceFilesExternals | null;
};
export declare function buildProjectGraphUsingProjectFileMap(projectRootMap: Record<string, ProjectConfiguration>, externalNodes: Record<string, ProjectGraphExternalNode>, fileMap: FileMap, allWorkspaceFiles: FileData[], rustReferences: NxWorkspaceFilesExternals, fileMapCache: FileMapCache | null, plugins: LoadedNxPlugin[]): Promise<{
    projectGraph: ProjectGraph;
    projectFileMapCache: FileMapCache;
}>;
export declare class ProcessDependenciesError extends Error {
    readonly pluginName: string;
    constructor(pluginName: string, { cause }: {
        cause: any;
    });
}
export declare class ProcessProjectGraphError extends Error {
    readonly pluginName: string;
    constructor(pluginName: string, { cause }: {
        cause: any;
    });
}
export declare class CreateDependenciesError extends Error {
    readonly errors: Array<ProcessDependenciesError | ProcessProjectGraphError>;
    readonly partialProjectGraph: ProjectGraph;
    constructor(errors: Array<ProcessDependenciesError | ProcessProjectGraphError>, partialProjectGraph: ProjectGraph);
}
