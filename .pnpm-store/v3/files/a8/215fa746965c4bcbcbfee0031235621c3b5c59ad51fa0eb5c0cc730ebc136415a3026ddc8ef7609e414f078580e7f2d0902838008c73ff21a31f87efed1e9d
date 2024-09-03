"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.targetToTargetString = exports.parseTargetString = void 0;
const nx_1 = require("../../nx");
let { readCachedProjectGraph, splitTarget, splitByColons } = (0, nx_1.requireNx)();
// TODO: Remove this in Nx 19 when Nx 16.7.0 is no longer supported
splitTarget = splitTarget ?? require('nx/src/utils/split-target').splitTarget;
splitByColons =
    splitByColons ?? ((s) => s.split(':'));
function parseTargetString(targetString, projectGraphOrCtx) {
    let projectGraph = projectGraphOrCtx && 'projectGraph' in projectGraphOrCtx
        ? projectGraphOrCtx.projectGraph
        : projectGraphOrCtx;
    if (!projectGraph) {
        try {
            projectGraph = readCachedProjectGraph();
        }
        catch (e) {
            projectGraph = { nodes: {} };
        }
    }
    const [maybeProject] = splitByColons(targetString);
    if (!projectGraph.nodes[maybeProject] &&
        projectGraphOrCtx &&
        'projectName' in projectGraphOrCtx &&
        maybeProject !== projectGraphOrCtx.projectName) {
        targetString = `${projectGraphOrCtx.projectName}:${targetString}`;
    }
    const [project, target, configuration] = splitTarget(targetString, projectGraph);
    if (!project || !target) {
        throw new Error(`Invalid Target String: ${targetString}`);
    }
    return {
        project,
        target,
        configuration,
    };
}
exports.parseTargetString = parseTargetString;
/**
 * Returns a string in the format "project:target[:configuration]" for the target
 *
 * @param target - target object
 *
 * Examples:
 *
 * ```typescript
 * targetToTargetString({ project: "proj", target: "test" }) // returns "proj:test"
 * targetToTargetString({ project: "proj", target: "test", configuration: "production" }) // returns "proj:test:production"
 * ```
 */
function targetToTargetString({ project, target, configuration, }) {
    return `${project}:${target.indexOf(':') > -1 ? `"${target}"` : target}${configuration !== undefined ? ':' + configuration : ''}`;
}
exports.targetToTargetString = targetToTargetString;
