"use strict";
var _ProjectGraphError_errors, _ProjectGraphError_partialProjectGraph, _ProjectGraphError_partialSourceMaps;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoadPluginError = exports.DaemonProjectGraphError = exports.isMergeNodesError = exports.isAggregateCreateNodesError = exports.isCreateNodesError = exports.MergeNodesError = exports.AggregateCreateNodesError = exports.CreateNodesError = exports.ProjectConfigurationsError = exports.isProjectsWithNoNameError = exports.ProjectsWithNoNameError = exports.isProjectsWithConflictingNamesError = exports.ProjectsWithConflictingNamesError = exports.ProjectGraphError = void 0;
const tslib_1 = require("tslib");
class ProjectGraphError extends Error {
    constructor(errors, partialProjectGraph, partialSourceMaps) {
        super(`Failed to process project graph.`);
        _ProjectGraphError_errors.set(this, void 0);
        _ProjectGraphError_partialProjectGraph.set(this, void 0);
        _ProjectGraphError_partialSourceMaps.set(this, void 0);
        this.name = this.constructor.name;
        tslib_1.__classPrivateFieldSet(this, _ProjectGraphError_errors, errors, "f");
        tslib_1.__classPrivateFieldSet(this, _ProjectGraphError_partialProjectGraph, partialProjectGraph, "f");
        tslib_1.__classPrivateFieldSet(this, _ProjectGraphError_partialSourceMaps, partialSourceMaps, "f");
        this.stack = `${this.message}\n  ${errors
            .map((error) => error.stack.split('\n').join('\n  '))
            .join('\n')}`;
    }
    /**
     * The daemon cannot throw errors which contain methods as they are not serializable.
     *
     * This method creates a new {@link ProjectGraphError} from a {@link DaemonProjectGraphError} with the methods based on the same serialized data.
     */
    static fromDaemonProjectGraphError(e) {
        return new ProjectGraphError(e.errors, e.projectGraph, e.sourceMaps);
    }
    /**
     * This gets the partial project graph despite the errors which occured.
     * This partial project graph may be missing nodes, properties of nodes, or dependencies.
     * This is useful mostly for visualization/debugging. It should not be used for running tasks.
     */
    getPartialProjectGraph() {
        return tslib_1.__classPrivateFieldGet(this, _ProjectGraphError_partialProjectGraph, "f");
    }
    getPartialSourcemaps() {
        return tslib_1.__classPrivateFieldGet(this, _ProjectGraphError_partialSourceMaps, "f");
    }
    getErrors() {
        return tslib_1.__classPrivateFieldGet(this, _ProjectGraphError_errors, "f");
    }
}
exports.ProjectGraphError = ProjectGraphError;
_ProjectGraphError_errors = new WeakMap(), _ProjectGraphError_partialProjectGraph = new WeakMap(), _ProjectGraphError_partialSourceMaps = new WeakMap();
class ProjectsWithConflictingNamesError extends Error {
    constructor(conflicts, projects) {
        super([
            `The following projects are defined in multiple locations:`,
            ...Array.from(conflicts.entries()).map(([project, roots]) => [`- ${project}: `, ...roots.map((r) => `  - ${r}`)].join('\n')),
            '',
            "To fix this, set a unique name for each project in a project.json inside the project's root. If the project does not currently have a project.json, you can create one that contains only a name.",
        ].join('\n'));
        this.projects = projects;
        this.name = this.constructor.name;
    }
}
exports.ProjectsWithConflictingNamesError = ProjectsWithConflictingNamesError;
function isProjectsWithConflictingNamesError(e) {
    return (e instanceof ProjectsWithConflictingNamesError ||
        (typeof e === 'object' &&
            'name' in e &&
            e?.name === ProjectsWithConflictingNamesError.prototype.name));
}
exports.isProjectsWithConflictingNamesError = isProjectsWithConflictingNamesError;
class ProjectsWithNoNameError extends Error {
    constructor(projectRoots, projects) {
        super(`The projects in the following directories have no name provided:\n  - ${projectRoots.join('\n  - ')}`);
        this.projects = projects;
        this.name = this.constructor.name;
    }
}
exports.ProjectsWithNoNameError = ProjectsWithNoNameError;
function isProjectsWithNoNameError(e) {
    return (e instanceof ProjectsWithNoNameError ||
        (typeof e === 'object' &&
            'name' in e &&
            e?.name === ProjectsWithNoNameError.prototype.name));
}
exports.isProjectsWithNoNameError = isProjectsWithNoNameError;
class ProjectConfigurationsError extends Error {
    constructor(errors, partialProjectConfigurationsResult) {
        super('Failed to create project configurations');
        this.errors = errors;
        this.partialProjectConfigurationsResult = partialProjectConfigurationsResult;
        this.name = this.constructor.name;
    }
}
exports.ProjectConfigurationsError = ProjectConfigurationsError;
class CreateNodesError extends Error {
    constructor({ file, pluginName, error, }) {
        const msg = `The "${pluginName}" plugin threw an error while creating nodes from ${file}:`;
        super(msg, { cause: error });
        this.name = this.constructor.name;
        this.file = file;
        this.pluginName = pluginName;
        this.stack = `${this.message}\n  ${error.stack.split('\n').join('\n  ')}`;
    }
}
exports.CreateNodesError = CreateNodesError;
class AggregateCreateNodesError extends Error {
    constructor(pluginName, errors, partialResults) {
        super('Failed to create nodes');
        this.pluginName = pluginName;
        this.errors = errors;
        this.partialResults = partialResults;
        this.name = this.constructor.name;
    }
}
exports.AggregateCreateNodesError = AggregateCreateNodesError;
class MergeNodesError extends Error {
    constructor({ file, pluginName, error, }) {
        const msg = `The nodes created from ${file} by the "${pluginName}" could not be merged into the project graph:`;
        super(msg, { cause: error });
        this.name = this.constructor.name;
        this.file = file;
        this.pluginName = pluginName;
        this.stack = `${this.message}\n  ${error.stack.split('\n').join('\n  ')}`;
    }
}
exports.MergeNodesError = MergeNodesError;
function isCreateNodesError(e) {
    return (e instanceof CreateNodesError ||
        (typeof e === 'object' && 'name' in e && e?.name === CreateNodesError.name));
}
exports.isCreateNodesError = isCreateNodesError;
function isAggregateCreateNodesError(e) {
    return (e instanceof AggregateCreateNodesError ||
        (typeof e === 'object' &&
            'name' in e &&
            e?.name === AggregateCreateNodesError.name));
}
exports.isAggregateCreateNodesError = isAggregateCreateNodesError;
function isMergeNodesError(e) {
    return (e instanceof MergeNodesError ||
        (typeof e === 'object' && 'name' in e && e?.name === MergeNodesError.name));
}
exports.isMergeNodesError = isMergeNodesError;
class DaemonProjectGraphError extends Error {
    constructor(errors, projectGraph, sourceMaps) {
        super(`The Daemon Process threw an error while calculating the project graph. Convert this error to a ProjectGraphError to get more information.`);
        this.errors = errors;
        this.projectGraph = projectGraph;
        this.sourceMaps = sourceMaps;
        this.name = this.constructor.name;
    }
}
exports.DaemonProjectGraphError = DaemonProjectGraphError;
class LoadPluginError extends Error {
    constructor(plugin, cause) {
        super(`Could not load plugin ${plugin}`, {
            cause,
        });
        this.plugin = plugin;
        this.name = this.constructor.name;
    }
}
exports.LoadPluginError = LoadPluginError;
