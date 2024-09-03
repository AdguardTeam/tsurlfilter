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

// libs/child-process/src/set-exit-code.ts
function setExitCode(code) {
  process.exitCode = code;
}
var init_set_exit_code = __esm({
  "libs/child-process/src/set-exit-code.ts"() {
    "use strict";
  }
});

// libs/child-process/src/index.ts
var src_exports = {};
__export(src_exports, {
  exec: () => exec,
  execSync: () => execSync,
  getChildProcessCount: () => getChildProcessCount,
  getExitCode: () => getExitCode,
  spawn: () => spawn,
  spawnStreaming: () => spawnStreaming
});
function exec(command, args, opts) {
  const options = Object.assign({ stdio: "pipe" }, opts);
  const spawned = spawnProcess(command, args, options);
  return wrapError(spawned);
}
function execSync(command, args, opts) {
  return import_execa.default.sync(command, args, opts).stdout;
}
function spawn(command, args, opts) {
  const options = Object.assign({}, opts, { stdio: "inherit" });
  const spawned = spawnProcess(command, args, options);
  return wrapError(spawned);
}
function spawnStreaming(command, args, opts, prefix) {
  const options = Object.assign({}, opts);
  options.stdio = ["ignore", "pipe", "pipe"];
  const spawned = spawnProcess(command, args, options);
  const stdoutOpts = {};
  const stderrOpts = {};
  if (prefix) {
    const colorName = colorWheel[currentColor % NUM_COLORS];
    const color = colorName;
    currentColor += 1;
    stdoutOpts.tag = `${color.bold(prefix)}:`;
    stderrOpts.tag = `${color(prefix)}:`;
  }
  if (children.size > process.stdout.listenerCount("close")) {
    process.stdout.setMaxListeners(children.size);
    process.stderr.setMaxListeners(children.size);
  }
  spawned.stdout?.pipe((0, import_strong_log_transformer.default)(stdoutOpts)).pipe(process.stdout);
  spawned.stderr?.pipe((0, import_strong_log_transformer.default)(stderrOpts)).pipe(process.stderr);
  return wrapError(spawned);
}
function getChildProcessCount() {
  return children.size;
}
function getExitCode(result) {
  if (result.exitCode) {
    return result.exitCode;
  }
  if (typeof result.code === "number") {
    return result.code;
  }
  if (typeof result.code === "string") {
    return import_os.default.constants.errno[result.code];
  }
  return process.exitCode;
}
function spawnProcess(command, args, opts) {
  const child = (0, import_execa.default)(command, args, opts);
  const drain = (exitCode, signal) => {
    children.delete(child);
    if (signal === void 0) {
      child.removeListener("exit", drain);
    }
    if (exitCode) {
      setExitCode(exitCode);
    }
  };
  child.once("exit", drain);
  child.once("error", drain);
  if (opts?.pkg) {
    child.pkg = opts.pkg;
  }
  children.add(child);
  return child;
}
function wrapError(spawned) {
  if (spawned.pkg) {
    return spawned.catch((err) => {
      err.exitCode = getExitCode(err);
      err.pkg = spawned.pkg;
      throw err;
    });
  }
  return spawned;
}
var import_os, import_chalk, import_execa, import_strong_log_transformer, children, colorWheel, NUM_COLORS, currentColor;
var init_src = __esm({
  "libs/child-process/src/index.ts"() {
    "use strict";
    import_os = __toESM(require("os"));
    import_chalk = __toESM(require("chalk"));
    import_execa = __toESM(require("execa"));
    import_strong_log_transformer = __toESM(require("strong-log-transformer"));
    init_set_exit_code();
    children = /* @__PURE__ */ new Set();
    colorWheel = [import_chalk.default.cyan, import_chalk.default.magenta, import_chalk.default.blue, import_chalk.default.yellow, import_chalk.default.green, import_chalk.default.blueBright];
    NUM_COLORS = colorWheel.length;
    currentColor = 0;
  }
});

// libs/commands/version/src/lib/git-add.ts
var git_add_exports = {};
__export(git_add_exports, {
  gitAdd: () => gitAdd
});
function resolvePrettier() {
  if (!resolvedPrettier) {
    try {
      const packageJson = (0, import_devkit.readJsonFile)(import_path.default.join(import_devkit.workspaceRoot, "package.json"));
      const hasPrettier = packageJson.devDependencies?.prettier || packageJson.dependencies?.prettier;
      if (!hasPrettier) {
        return;
      }
      resolvedPrettier = require("prettier");
    } catch {
      return;
    }
  }
  return resolvedPrettier;
}
async function maybeFormatFile(filePath) {
  const prettier = resolvePrettier();
  if (!prettier) {
    return;
  }
  const config = await resolvedPrettier.resolveConfig(filePath);
  const ignorePath = import_path.default.join(import_devkit.workspaceRoot, ".prettierignore");
  const fullFilePath = import_path.default.join(import_devkit.workspaceRoot, filePath);
  const fileInfo = await resolvedPrettier.getFileInfo(fullFilePath, { ignorePath });
  if (fileInfo.ignored) {
    import_npmlog.default.silly("version", `Skipped applying prettier to ignored file: ${filePath}`);
    return;
  }
  try {
    const input = import_fs.default.readFileSync(fullFilePath, "utf8");
    import_fs.default.writeFileSync(
      fullFilePath,
      await resolvedPrettier.format(input, { ...config, filepath: fullFilePath }),
      "utf8"
    );
    import_npmlog.default.silly("version", `Successfully applied prettier to updated file: ${filePath}`);
  } catch {
    import_npmlog.default.silly("version", `Failed to apply prettier to updated file: ${filePath}`);
  }
}
async function gitAdd(changedFiles, gitOpts, execOpts) {
  let files = [];
  for (const file of changedFiles) {
    const filePath = (0, import_slash.default)(import_path.default.relative(execOpts.cwd, import_path.default.resolve(execOpts.cwd, file)));
    await maybeFormatFile(filePath);
    if (gitOpts.granularPathspec) {
      files.push(filePath);
    }
  }
  if (!gitOpts.granularPathspec) {
    files = ".";
  }
  import_npmlog.default.silly("gitAdd", files);
  return childProcess.exec("git", ["add", "--", ...files], execOpts);
}
var import_devkit, import_fs, import_npmlog, import_path, import_slash, childProcess, resolvedPrettier;
var init_git_add = __esm({
  "libs/commands/version/src/lib/git-add.ts"() {
    "use strict";
    import_devkit = require("@nx/devkit");
    import_fs = __toESM(require("fs"));
    import_npmlog = __toESM(require("npmlog"));
    import_path = __toESM(require("path"));
    import_slash = __toESM(require("slash"));
    childProcess = (init_src(), __toCommonJS(src_exports));
  }
});

// packages/lerna/src/commands/version/lib/git-add.ts
module.exports = (init_git_add(), __toCommonJS(git_add_exports));
