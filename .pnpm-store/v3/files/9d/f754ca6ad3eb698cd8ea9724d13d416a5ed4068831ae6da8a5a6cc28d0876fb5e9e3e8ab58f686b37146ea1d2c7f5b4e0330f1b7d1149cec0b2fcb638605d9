"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateDependenciesError = exports.ProcessProjectGraphError = exports.ProcessDependenciesError = exports.buildProjectGraphUsingProjectFileMap = exports.getFileMap = void 0;
const workspace_root_1 = require("../utils/workspace-root");
const path_1 = require("path");
const perf_hooks_1 = require("perf_hooks");
const assert_workspace_validity_1 = require("../utils/assert-workspace-validity");
const nx_deps_cache_1 = require("./nx-deps-cache");
const implicit_project_dependencies_1 = require("./utils/implicit-project-dependencies");
const normalize_project_nodes_1 = require("./utils/normalize-project-nodes");
const utils_1 = require("./plugins/utils");
const typescript_1 = require("../plugins/js/utils/typescript");
const fileutils_1 = require("../utils/fileutils");
const project_graph_builder_1 = require("./project-graph-builder");
const configuration_1 = require("../config/configuration");
const fs_1 = require("fs");
const output_1 = require("../utils/output");
let storedFileMap = null;
let storedAllWorkspaceFiles = null;
let storedRustReferences = null;
function getFileMap() {
    if (!!storedFileMap) {
        return {
            fileMap: storedFileMap,
            allWorkspaceFiles: storedAllWorkspaceFiles,
            rustReferences: storedRustReferences,
        };
    }
    else {
        return {
            fileMap: {
                nonProjectFiles: [],
                projectFileMap: {},
            },
            allWorkspaceFiles: [],
            rustReferences: null,
        };
    }
}
exports.getFileMap = getFileMap;
async function buildProjectGraphUsingProjectFileMap(projectRootMap, externalNodes, fileMap, allWorkspaceFiles, rustReferences, fileMapCache, plugins) {
    storedFileMap = fileMap;
    storedAllWorkspaceFiles = allWorkspaceFiles;
    storedRustReferences = rustReferences;
    const projects = {};
    for (const root in projectRootMap) {
        const project = projectRootMap[root];
        projects[project.name] = project;
    }
    const nxJson = (0, configuration_1.readNxJson)();
    const projectGraphVersion = '6.0';
    (0, assert_workspace_validity_1.assertWorkspaceValidity)(projects, nxJson);
    const packageJsonDeps = readCombinedDeps();
    const rootTsConfig = readRootTsConfig();
    let filesToProcess;
    let cachedFileData;
    const useCacheData = fileMapCache &&
        !(0, nx_deps_cache_1.shouldRecomputeWholeGraph)(fileMapCache, packageJsonDeps, projects, nxJson, rootTsConfig);
    if (useCacheData) {
        const fromCache = (0, nx_deps_cache_1.extractCachedFileData)(fileMap, fileMapCache);
        filesToProcess = fromCache.filesToProcess;
        cachedFileData = fromCache.cachedFileData;
    }
    else {
        filesToProcess = fileMap;
        cachedFileData = {
            nonProjectFiles: {},
            projectFileMap: {},
        };
    }
    const context = createContext(projects, nxJson, externalNodes, fileMap, filesToProcess);
    let projectGraph = await buildProjectGraphUsingContext(externalNodes, context, cachedFileData, projectGraphVersion, plugins);
    const projectFileMapCache = (0, nx_deps_cache_1.createProjectFileMapCache)(nxJson, packageJsonDeps, fileMap, rootTsConfig);
    return {
        projectGraph,
        projectFileMapCache,
    };
}
exports.buildProjectGraphUsingProjectFileMap = buildProjectGraphUsingProjectFileMap;
function readCombinedDeps() {
    const installationPackageJsonPath = (0, path_1.join)(workspace_root_1.workspaceRoot, '.nx', 'installation', 'package.json');
    const installationPackageJson = (0, fs_1.existsSync)(installationPackageJsonPath)
        ? (0, fileutils_1.readJsonFile)(installationPackageJsonPath)
        : {};
    const rootPackageJsonPath = (0, path_1.join)(workspace_root_1.workspaceRoot, 'package.json');
    const rootPackageJson = (0, fs_1.existsSync)(rootPackageJsonPath)
        ? (0, fileutils_1.readJsonFile)(rootPackageJsonPath)
        : {};
    return {
        ...rootPackageJson.dependencies,
        ...rootPackageJson.devDependencies,
        ...installationPackageJson.dependencies,
        ...installationPackageJson.devDependencies,
    };
}
async function buildProjectGraphUsingContext(knownExternalNodes, ctx, cachedFileData, projectGraphVersion, plugins) {
    perf_hooks_1.performance.mark('build project graph:start');
    const builder = new project_graph_builder_1.ProjectGraphBuilder(null, ctx.fileMap.projectFileMap);
    builder.setVersion(projectGraphVersion);
    for (const node in knownExternalNodes) {
        builder.addExternalNode(knownExternalNodes[node]);
    }
    await (0, normalize_project_nodes_1.normalizeProjectNodes)(ctx, builder);
    const initProjectGraph = builder.getUpdatedProjectGraph();
    let updatedGraph;
    let error;
    try {
        updatedGraph = await updateProjectGraphWithPlugins(ctx, initProjectGraph, plugins);
    }
    catch (e) {
        if (e instanceof CreateDependenciesError) {
            updatedGraph = e.partialProjectGraph;
            error = e;
        }
        else {
            throw e;
        }
    }
    const updatedBuilder = new project_graph_builder_1.ProjectGraphBuilder(updatedGraph, ctx.fileMap.projectFileMap);
    for (const proj of Object.keys(cachedFileData.projectFileMap)) {
        for (const f of ctx.fileMap.projectFileMap[proj] || []) {
            const cached = cachedFileData.projectFileMap[proj][f.file];
            if (cached && cached.deps) {
                f.deps = [...cached.deps];
            }
        }
    }
    for (const file of ctx.fileMap.nonProjectFiles) {
        const cached = cachedFileData.nonProjectFiles[file.file];
        if (cached?.deps) {
            file.deps = [...cached.deps];
        }
    }
    (0, implicit_project_dependencies_1.applyImplicitDependencies)(ctx.projects, updatedBuilder);
    const finalGraph = updatedBuilder.getUpdatedProjectGraph();
    perf_hooks_1.performance.mark('build project graph:end');
    perf_hooks_1.performance.measure('build project graph', 'build project graph:start', 'build project graph:end');
    if (!error) {
        return finalGraph;
    }
    else {
        throw new CreateDependenciesError(error.errors, finalGraph);
    }
}
function createContext(projects, nxJson, externalNodes, fileMap, filesToProcess) {
    return {
        nxJsonConfiguration: nxJson,
        projects,
        externalNodes,
        workspaceRoot: workspace_root_1.workspaceRoot,
        fileMap,
        filesToProcess,
    };
}
async function updateProjectGraphWithPlugins(context, initProjectGraph, plugins) {
    let graph = initProjectGraph;
    const errors = [];
    for (const plugin of plugins) {
        try {
            if ((0, utils_1.isNxPluginV1)(plugin) &&
                plugin.processProjectGraph &&
                !plugin.createDependencies) {
                output_1.output.warn({
                    title: `${plugin.name} is a v1 plugin.`,
                    bodyLines: [
                        'Nx has recently released a v2 model for project graph plugins. The `processProjectGraph` method is deprecated. Plugins should use some combination of `createNodes` and `createDependencies` instead.',
                    ],
                });
                perf_hooks_1.performance.mark(`${plugin.name}:processProjectGraph - start`);
                graph = await plugin.processProjectGraph(graph, {
                    ...context,
                    projectsConfigurations: {
                        projects: context.projects,
                        version: 2,
                    },
                    fileMap: context.fileMap.projectFileMap,
                    filesToProcess: context.filesToProcess.projectFileMap,
                    workspace: {
                        version: 2,
                        projects: context.projects,
                        ...context.nxJsonConfiguration,
                    },
                });
                perf_hooks_1.performance.mark(`${plugin.name}:processProjectGraph - end`);
                perf_hooks_1.performance.measure(`${plugin.name}:processProjectGraph`, `${plugin.name}:processProjectGraph - start`, `${plugin.name}:processProjectGraph - end`);
            }
        }
        catch (e) {
            errors.push(new ProcessProjectGraphError(plugin.name, {
                cause: e,
            }));
        }
    }
    const builder = new project_graph_builder_1.ProjectGraphBuilder(graph, context.fileMap.projectFileMap, context.fileMap.nonProjectFiles);
    const createDependencyPlugins = plugins.filter((plugin) => (0, utils_1.isNxPluginV2)(plugin) && plugin.createDependencies);
    await Promise.all(createDependencyPlugins.map(async (plugin) => {
        perf_hooks_1.performance.mark(`${plugin.name}:createDependencies - start`);
        try {
            const dependencies = await plugin.createDependencies({
                ...context,
            });
            for (const dep of dependencies) {
                builder.addDependency(dep.source, dep.target, dep.type, 'sourceFile' in dep ? dep.sourceFile : null);
            }
        }
        catch (cause) {
            errors.push(new ProcessDependenciesError(plugin.name, {
                cause,
            }));
        }
        perf_hooks_1.performance.mark(`${plugin.name}:createDependencies - end`);
        perf_hooks_1.performance.measure(`${plugin.name}:createDependencies`, `${plugin.name}:createDependencies - start`, `${plugin.name}:createDependencies - end`);
    }));
    const result = builder.getUpdatedProjectGraph();
    if (errors.length === 0) {
        return result;
    }
    else {
        throw new CreateDependenciesError(errors, result);
    }
}
class ProcessDependenciesError extends Error {
    constructor(pluginName, { cause }) {
        super(`The "${pluginName}" plugin threw an error while creating dependencies:`, {
            cause,
        });
        this.pluginName = pluginName;
        this.name = this.constructor.name;
        this.stack = `${this.message}\n  ${cause.stack.split('\n').join('\n  ')}`;
    }
}
exports.ProcessDependenciesError = ProcessDependenciesError;
class ProcessProjectGraphError extends Error {
    constructor(pluginName, { cause }) {
        super(`The "${pluginName}" plugin threw an error while processing the project graph:`, {
            cause,
        });
        this.pluginName = pluginName;
        this.name = this.constructor.name;
        this.stack = `${this.message}\n  ${cause.stack.split('\n').join('\n  ')}`;
    }
}
exports.ProcessProjectGraphError = ProcessProjectGraphError;
class CreateDependenciesError extends Error {
    constructor(errors, partialProjectGraph) {
        super('Failed to create dependencies. See above for errors');
        this.errors = errors;
        this.partialProjectGraph = partialProjectGraph;
        this.name = this.constructor.name;
    }
}
exports.CreateDependenciesError = CreateDependenciesError;
function readRootTsConfig() {
    try {
        const tsConfigPath = (0, typescript_1.getRootTsConfigPath)();
        if (tsConfigPath) {
            return (0, fileutils_1.readJsonFile)(tsConfigPath, { expectComments: true });
        }
    }
    catch (e) {
        return {};
    }
}
