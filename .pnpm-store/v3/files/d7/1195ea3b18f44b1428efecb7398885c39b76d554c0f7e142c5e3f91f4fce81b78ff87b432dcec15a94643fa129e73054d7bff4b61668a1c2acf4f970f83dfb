"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireNx = void 0;
// After Nx v19, this can be removed and replaced with either:
// - import {} from 'nx/src/devkit-exports'
// - import {} from 'nx/src/devkit-internals'
function requireNx() {
    let result = { ...require('nx/src/devkit-exports') };
    try {
        result = {
            ...result,
            // Remove in Nx v19, devkit should not support Nx v16.0.2 at that point.
            ...require('nx/src/devkit-internals'),
        };
    }
    catch { }
    return result;
}
exports.requireNx = requireNx;
