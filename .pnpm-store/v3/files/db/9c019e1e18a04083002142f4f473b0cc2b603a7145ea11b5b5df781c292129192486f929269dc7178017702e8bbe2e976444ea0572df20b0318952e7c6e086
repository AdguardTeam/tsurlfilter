"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installPackagesTask = void 0;
const child_process_1 = require("child_process");
const path_1 = require("path");
const nx_1 = require("../../nx");
const { detectPackageManager, getPackageManagerCommand, joinPathFragments } = (0, nx_1.requireNx)();
/**
 * Runs `npm install` or `yarn install`. It will skip running the install if
 * `package.json` hasn't changed at all or it hasn't changed since the last invocation.
 *
 * @param tree - the file system tree
 * @param alwaysRun - always run the command even if `package.json` hasn't changed.
 */
function installPackagesTask(tree, alwaysRun = false, cwd = '', packageManager = detectPackageManager(cwd)) {
    if (!tree
        .listChanges()
        .find((f) => f.path === joinPathFragments(cwd, 'package.json')) &&
        !alwaysRun) {
        return;
    }
    const packageJsonValue = tree.read(joinPathFragments(cwd, 'package.json'), 'utf-8');
    let storedPackageJsonValue = global['__packageJsonInstallCache__'];
    // Don't install again if install was already executed with package.json
    if (storedPackageJsonValue != packageJsonValue || alwaysRun) {
        global['__packageJsonInstallCache__'] = packageJsonValue;
        const pmc = getPackageManagerCommand(packageManager);
        const execSyncOptions = {
            cwd: (0, path_1.join)(tree.root, cwd),
            stdio: process.env.NX_GENERATE_QUIET === 'true' ? 'ignore' : 'inherit',
        };
        // ensure local registry from process is not interfering with the install
        // when we start the process from temp folder the local registry would override the custom registry
        if (process.env.npm_config_registry &&
            process.env.npm_config_registry.match(/^https:\/\/registry\.(npmjs\.org|yarnpkg\.com)/)) {
            delete process.env.npm_config_registry;
        }
        (0, child_process_1.execSync)(pmc.install, execSyncOptions);
    }
}
exports.installPackagesTask = installPackagesTask;
