"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// libs/commands/version/src/lib/update-lockfile-version.ts
var update_lockfile_version_exports = {};
__export(update_lockfile_version_exports, {
  updateLockfileVersion: () => updateLockfileVersion
});
async function updateLockfileVersion(pkg) {
  const lockfilePath = import_path.default.join(pkg.location, "package-lock.json");
  const obj = await (0, import_load_json_file.default)(lockfilePath).catch(() => {
    import_npmlog.default.verbose("version", `${pkg.name} has no lockfile. Skipping lockfile update.`);
  });
  if (!obj) {
    return;
  }
  obj.version = pkg.version;
  if (obj.packages && obj.packages[""]) {
    obj.packages[""].version = pkg.version;
    if (obj.packages[""].dependencies) {
      const updatedPkgDependencies = Object.keys(obj.packages[""].dependencies).reduce(
        (prev, next) => ({ ...prev, [next]: pkg.dependencies?.[next] }),
        {}
      );
      obj.packages[""].dependencies = updatedPkgDependencies;
    }
    if (obj.packages[""].devDependencies) {
      const updatedPkgDevDependencies = Object.keys(obj.packages[""].devDependencies).reduce(
        (prev, next) => ({ ...prev, [next]: pkg.devDependencies?.[next] }),
        {}
      );
      obj.packages[""].devDependencies = updatedPkgDevDependencies;
    }
  }
  (0, import_devkit.writeJsonFile)(lockfilePath, obj, {
    spaces: 2
  });
  return lockfilePath;
}
var import_devkit, import_load_json_file, import_npmlog, import_path;
var init_update_lockfile_version = __esm({
  "libs/commands/version/src/lib/update-lockfile-version.ts"() {
    "use strict";
    import_devkit = require("@nx/devkit");
    import_load_json_file = __toESM(require("load-json-file"));
    import_npmlog = __toESM(require("npmlog"));
    import_path = __toESM(require("path"));
  }
});

// packages/lerna/src/commands/version/lib/update-lockfile-version.ts
module.exports = (init_update_lockfile_version(), __toCommonJS(update_lockfile_version_exports));
