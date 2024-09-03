"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addBuildTargetDefaults = void 0;
const nx_1 = require("../../nx");
const { readNxJson, updateNxJson } = (0, nx_1.requireNx)();
function addBuildTargetDefaults(tree, executorName, buildTargetName = 'build') {
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults ??= {};
    nxJson.targetDefaults[executorName] ??= {
        cache: true,
        dependsOn: [`^${buildTargetName}`],
        inputs: nxJson.namedInputs && 'production' in nxJson.namedInputs
            ? ['production', '^production']
            : ['default', '^default'],
    };
    updateNxJson(tree, nxJson);
}
exports.addBuildTargetDefaults = addBuildTargetDefaults;
