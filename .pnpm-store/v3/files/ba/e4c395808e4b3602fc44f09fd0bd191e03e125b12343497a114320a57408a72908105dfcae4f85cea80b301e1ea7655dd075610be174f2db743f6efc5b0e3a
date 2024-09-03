"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readTargetOptions = void 0;
const nx_1 = require("../../nx");
const path_1 = require("path");
let { Workspaces, getExecutorInformation, calculateDefaultProjectName, combineOptionsForExecutor, } = (0, nx_1.requireNx)();
// TODO: Remove this in Nx 19 when Nx 16.7.0 is no longer supported
combineOptionsForExecutor =
    combineOptionsForExecutor ??
        require('nx/src/utils/params').combineOptionsForExecutor;
/**
 * Reads and combines options for a given target.
 *
 * Works as if you invoked the target yourself without passing any command lint overrides.
 */
function readTargetOptions({ project, target, configuration }, context) {
    const projectConfiguration = (context.workspace || context.projectsConfigurations).projects[project];
    if (!projectConfiguration) {
        throw new Error(`Unable to find project ${project}`);
    }
    const targetConfiguration = projectConfiguration.targets[target];
    if (!targetConfiguration) {
        throw new Error(`Unable to find target ${target} for project ${project}`);
    }
    // TODO(v19): remove Workspaces.
    const ws = new Workspaces(context.root);
    const [nodeModule, executorName] = targetConfiguration.executor.split(':');
    const { schema } = getExecutorInformation
        ? getExecutorInformation(nodeModule, executorName, context.root, context.projectsConfigurations?.projects ?? context.workspace.projects)
        : // TODO(v19): remove readExecutor. This is to be backwards compatible with Nx 16.5 and below.
            ws.readExecutor(nodeModule, executorName);
    const defaultProject = calculateDefaultProjectName
        ? calculateDefaultProjectName(context.cwd, context.root, { version: 2, projects: context.projectsConfigurations.projects }, context.nxJsonConfiguration)
        : // TODO(v19): remove calculateDefaultProjectName. This is to be backwards compatible with Nx 16.5 and below.
            ws.calculateDefaultProjectName(context.cwd, { version: 2, projects: context.projectsConfigurations.projects }, context.nxJsonConfiguration);
    return combineOptionsForExecutor({}, configuration ?? targetConfiguration.defaultConfiguration ?? '', targetConfiguration, schema, defaultProject, (0, path_1.relative)(context.root, context.cwd));
}
exports.readTargetOptions = readTargetOptions;
