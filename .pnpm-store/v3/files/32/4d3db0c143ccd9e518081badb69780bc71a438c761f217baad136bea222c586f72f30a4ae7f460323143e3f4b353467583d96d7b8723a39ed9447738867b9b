"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateHashForCreateNodes = void 0;
const nx_1 = require("../../nx");
const path_1 = require("path");
const { hashWithWorkspaceContext, hashArray, hashObject } = (0, nx_1.requireNx)();
function calculateHashForCreateNodes(projectRoot, options, context, additionalGlobs = []) {
    return hashArray([
        hashWithWorkspaceContext(context.workspaceRoot, [
            (0, path_1.join)(projectRoot, '**/*'),
            ...additionalGlobs,
        ]),
        hashObject(options),
    ]);
}
exports.calculateHashForCreateNodes = calculateHashForCreateNodes;
