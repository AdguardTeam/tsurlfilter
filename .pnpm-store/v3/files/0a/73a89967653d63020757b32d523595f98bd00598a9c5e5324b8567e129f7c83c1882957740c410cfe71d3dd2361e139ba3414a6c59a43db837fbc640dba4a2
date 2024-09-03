"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// packages/lerna/src/commands/diff/lib/has-commit.ts
var has_commit_exports = {};
__export(has_commit_exports, {
  hasCommit: () => hasCommit
});
module.exports = __toCommonJS(has_commit_exports);

// libs/commands/diff/src/lib/has-commit.ts
var import_npmlog = __toESM(require("npmlog"));

// libs/child-process/src/index.ts
var import_chalk = __toESM(require("chalk"));
var import_execa = __toESM(require("execa"));
var import_strong_log_transformer = __toESM(require("strong-log-transformer"));
var colorWheel = [import_chalk.default.cyan, import_chalk.default.magenta, import_chalk.default.blue, import_chalk.default.yellow, import_chalk.default.green, import_chalk.default.blueBright];
var NUM_COLORS = colorWheel.length;
function execSync(command, args, opts) {
  return import_execa.default.sync(command, args, opts).stdout;
}

// libs/commands/diff/src/lib/has-commit.ts
function hasCommit(opts) {
  import_npmlog.default.silly("hasCommit", "");
  let retVal;
  try {
    execSync("git", ["log"], opts);
    retVal = true;
  } catch (e) {
    retVal = false;
  }
  import_npmlog.default.verbose("hasCommit", retVal.toString());
  return retVal;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  hasCommit
});
