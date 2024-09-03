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

// libs/commands/version/src/lib/git-push.ts
var git_push_exports = {};
__export(git_push_exports, {
  gitPush: () => gitPush
});
function gitPush(remote, branch, opts) {
  import_npmlog.default.silly("gitPush", remote, branch);
  return childProcess.exec("git", ["push", "--follow-tags", "--no-verify", "--atomic", remote, branch], opts).catch((error) => {
    if (/atomic/.test(error.stderr) || process.env.GIT_REDIRECT_STDERR === "2>&1" && /atomic/.test(error.stdout)) {
      import_npmlog.default.warn("gitPush", error.stderr);
      import_npmlog.default.info("gitPush", "--atomic failed, attempting non-atomic push");
      return childProcess.exec("git", ["push", "--follow-tags", "--no-verify", remote, branch], opts);
    }
    throw error;
  });
}
var import_npmlog, childProcess;
var init_git_push = __esm({
  "libs/commands/version/src/lib/git-push.ts"() {
    "use strict";
    import_npmlog = __toESM(require("npmlog"));
    childProcess = (init_src(), __toCommonJS(src_exports));
  }
});

// packages/lerna/src/commands/version/lib/git-push.ts
module.exports = (init_git_push(), __toCommonJS(git_push_exports));
