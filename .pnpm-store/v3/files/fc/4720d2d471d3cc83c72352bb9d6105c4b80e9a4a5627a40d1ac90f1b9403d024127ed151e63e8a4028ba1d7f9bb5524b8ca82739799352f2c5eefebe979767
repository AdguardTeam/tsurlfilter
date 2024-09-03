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
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
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

// libs/core/src/lib/add-dependencies.ts
function addDependencies(projects, projectGraph) {
  const projectsLookup = new Set(projects.map((p) => p.name));
  const dependencies = projectGraph.localPackageDependencies;
  const collected = /* @__PURE__ */ new Set();
  projects.forEach((currentNode) => {
    if (dependencies[currentNode.name] && dependencies[currentNode.name].length === 0) {
      return;
    }
    const queue2 = [currentNode];
    const seen = /* @__PURE__ */ new Set();
    while (queue2.length) {
      const node = queue2.shift();
      dependencies[node.name]?.forEach(({ target }) => {
        if (seen.has(target)) {
          return;
        }
        seen.add(target);
        if (target === currentNode.name || projectsLookup.has(target)) {
          return;
        }
        const dependencyNode = projectGraph.nodes[target];
        collected.add(dependencyNode);
        queue2.push(dependencyNode);
      });
    }
  });
  return Array.from(/* @__PURE__ */ new Set([...projects, ...collected]));
}
var init_add_dependencies = __esm({
  "libs/core/src/lib/add-dependencies.ts"() {
    "use strict";
  }
});

// libs/core/src/lib/add-dependents.ts
function addDependents(projects, projectGraph) {
  const projectsLookup = new Set(projects.map((p) => p.name));
  const dependents = (0, import_lodash.flatten)(
    Object.values(projectGraph.localPackageDependencies)
  ).reduce(
    (prev, next) => ({
      ...prev,
      [next.target]: [...prev[next.target] || [], next.source]
    }),
    {}
  );
  const collected = /* @__PURE__ */ new Set();
  projects.forEach((currentNode) => {
    if (dependents[currentNode.name] && dependents[currentNode.name].length === 0) {
      return;
    }
    const queue2 = [currentNode];
    const seen = /* @__PURE__ */ new Set();
    while (queue2.length) {
      const node = queue2.shift();
      dependents[node.name]?.forEach((dep) => {
        if (seen.has(dep)) {
          return;
        }
        seen.add(dep);
        if (dep === currentNode.name || projectsLookup.has(dep)) {
          return;
        }
        const dependentNode = projectGraph.nodes[dep];
        collected.add(dependentNode);
        queue2.push(dependentNode);
      });
    }
  });
  return Array.from(/* @__PURE__ */ new Set([...projects, ...collected]));
}
var import_lodash;
var init_add_dependents = __esm({
  "libs/core/src/lib/add-dependents.ts"() {
    "use strict";
    import_lodash = require("lodash");
  }
});

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

// libs/core/src/lib/collect-uncommitted.ts
function collectUncommitted({ cwd, log: log34 = import_npmlog.default }) {
  log34.silly("collect-uncommitted", "git status --porcelain (async)");
  return childProcess.exec("git", ["status", "--porcelain"], { cwd }).then(({ stdout }) => transformOutput(stdout));
}
var import_chalk2, import_npmlog, childProcess, maybeColorize, cRed, cGreen, replaceStatus, colorizeStats, splitOnNewLine, filterEmpty, o, transformOutput;
var init_collect_uncommitted = __esm({
  "libs/core/src/lib/collect-uncommitted.ts"() {
    "use strict";
    import_chalk2 = __toESM(require("chalk"));
    import_npmlog = __toESM(require("npmlog"));
    childProcess = (init_src(), __toCommonJS(src_exports));
    maybeColorize = (colorize) => (s) => s !== " " ? colorize(s) : s;
    cRed = maybeColorize(import_chalk2.default.red);
    cGreen = maybeColorize(import_chalk2.default.green);
    replaceStatus = (_, maybeGreen, maybeRed) => `${cGreen(maybeGreen)}${cRed(maybeRed)}`;
    colorizeStats = (stats) => stats.replace(/^([^U]| )([A-Z]| )/gm, replaceStatus).replace(/^\?{2}|U{2}/gm, cRed("$&"));
    splitOnNewLine = (str) => str.split("\n");
    filterEmpty = (lines) => lines.filter((line) => line.length);
    o = (l, r) => (x) => l(r(x));
    transformOutput = o(filterEmpty, o(splitOnNewLine, colorizeStats));
  }
});

// libs/core/src/lib/describe-ref.ts
function getArgs(options, includeMergedTags = false) {
  let args = [
    "describe",
    // fallback to short sha if no tags located
    "--always",
    // always return full result, helps identify existing release
    "--long",
    // annotate if uncommitted changes present
    "--dirty",
    // prefer tags originating on upstream branch
    "--first-parent"
  ];
  if (options.match) {
    args.push("--match", options.match);
  }
  if (includeMergedTags) {
    args = args.filter((arg) => arg !== "--first-parent");
  }
  return args;
}
function describeRefSync(options = {}, includeMergedTags) {
  const stdout = childProcess2.execSync("git", getArgs(options, includeMergedTags), options);
  const result = parse(stdout, options.cwd, options.separator);
  import_npmlog2.default.silly("git-describe.sync", "%j => %j", stdout, result);
  return result;
}
function parse(stdout, cwd, separator) {
  separator = separator || "@";
  const minimalShaRegex = /^([0-9a-f]{7,40})(-dirty)?$/;
  if (minimalShaRegex.test(stdout)) {
    const [, sha2, isDirty2] = minimalShaRegex.exec(stdout);
    const refCount2 = childProcess2.execSync("git", ["rev-list", "--count", sha2], { cwd });
    return { refCount: refCount2, sha: sha2, isDirty: Boolean(isDirty2) };
  }
  const escapedSeparator = separator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regexPattern = new RegExp(`^((?:.*${escapedSeparator})?(.*))-(\\d+)-g([0-9a-f]+)(-dirty)?$`);
  const [, lastTagName, lastVersion, refCount, sha, isDirty] = regexPattern.exec(stdout) || [];
  return { lastTagName, lastVersion, refCount, sha, isDirty: Boolean(isDirty) };
}
var import_npmlog2, childProcess2;
var init_describe_ref = __esm({
  "libs/core/src/lib/describe-ref.ts"() {
    "use strict";
    import_npmlog2 = __toESM(require("npmlog"));
    childProcess2 = (init_src(), __toCommonJS(src_exports));
  }
});

// libs/core/src/lib/validation-error.ts
var import_npmlog3, ValidationError;
var init_validation_error = __esm({
  "libs/core/src/lib/validation-error.ts"() {
    "use strict";
    import_npmlog3 = __toESM(require("npmlog"));
    ValidationError = class extends Error {
      constructor(prefix, message, ...rest) {
        super(message);
        this.name = "ValidationError";
        this.prefix = prefix;
        import_npmlog3.default.resume();
        import_npmlog3.default.error(prefix, message, ...rest);
      }
    };
  }
});

// libs/core/src/lib/check-working-tree.ts
function mkThrowIfUncommitted(options = {}) {
  return function throwIfUncommitted2(opts) {
    if (opts.isDirty) {
      return collectUncommitted(options).then((uncommitted) => {
        throw new ValidationError("EUNCOMMIT", `${EUNCOMMIT_MSG}${uncommitted.join("\n")}`);
      });
    }
  };
}
var EUNCOMMIT_MSG, throwIfUncommitted;
var init_check_working_tree = __esm({
  "libs/core/src/lib/check-working-tree.ts"() {
    "use strict";
    init_collect_uncommitted();
    init_describe_ref();
    init_validation_error();
    EUNCOMMIT_MSG = "Working tree has uncommitted changes, please commit or remove the following changes before continuing:\n";
    throwIfUncommitted = mkThrowIfUncommitted();
  }
});

// libs/core/src/lib/cli.ts
var import_dedent, import_npmlog4, import_yargs;
var init_cli = __esm({
  "libs/core/src/lib/cli.ts"() {
    "use strict";
    import_dedent = __toESM(require("dedent"));
    import_npmlog4 = __toESM(require("npmlog"));
    import_yargs = __toESM(require("yargs"));
  }
});

// libs/core/src/lib/get-packages-for-option.ts
function getPackagesForOption(option) {
  let inputs = null;
  if (option === true) {
    inputs = ["*"];
  } else if (typeof option === "string") {
    inputs = option.split(",");
  } else if (Array.isArray(option)) {
    inputs = [...option];
  }
  return new Set(inputs);
}
var init_get_packages_for_option = __esm({
  "libs/core/src/lib/get-packages-for-option.ts"() {
    "use strict";
  }
});

// libs/core/src/lib/prerelease-id-from-version.ts
function prereleaseIdFromVersion(version) {
  return (import_semver.default.prerelease(version) || []).shift();
}
var import_semver;
var init_prerelease_id_from_version = __esm({
  "libs/core/src/lib/prerelease-id-from-version.ts"() {
    "use strict";
    import_semver = __toESM(require("semver"));
  }
});

// libs/core/src/lib/project-graph-with-packages.ts
function getPackage(project) {
  if (!project.package) {
    throw new Error(`Failed attempting to find package for project ${project.name}`);
  }
  return project.package;
}
var isExternalNpmDependency;
var init_project_graph_with_packages = __esm({
  "libs/core/src/lib/project-graph-with-packages.ts"() {
    "use strict";
    isExternalNpmDependency = (dep) => dep.startsWith("npm:");
  }
});

// libs/core/src/lib/collect-updates/has-tags.ts
function hasTags(opts) {
  import_npmlog5.default.silly("hasTags");
  let result = false;
  try {
    result = !!childProcess3.execSync("git", ["tag"], opts);
  } catch (err) {
    import_npmlog5.default.warn("ENOTAGS", "No git tags were reachable from this branch!");
    import_npmlog5.default.verbose("hasTags error", err);
  }
  import_npmlog5.default.verbose("hasTags", result);
  return result;
}
var import_npmlog5, childProcess3;
var init_has_tags = __esm({
  "libs/core/src/lib/collect-updates/has-tags.ts"() {
    "use strict";
    import_npmlog5 = __toESM(require("npmlog"));
    childProcess3 = (init_src(), __toCommonJS(src_exports));
  }
});

// libs/core/src/lib/collect-updates/make-diff-predicate.ts
function makeDiffPredicate(committish, execOpts, ignorePatterns = []) {
  const ignoreFilters = new Set(
    ignorePatterns.map(
      (p) => import_minimatch.default.filter(`!${p}`, {
        matchBase: true,
        // dotfiles inside ignored directories should also match
        dot: true
      })
    )
  );
  if (ignoreFilters.size) {
    import_npmlog6.default.info("ignoring diff in paths matching", ignorePatterns);
  }
  return function hasDiffSinceThatIsntIgnored(node) {
    const diff = diffSinceIn(committish, getPackage(node).location, execOpts);
    if (diff === "") {
      import_npmlog6.default.silly("", "no diff found in %s", node.name);
      return false;
    }
    import_npmlog6.default.silly("found diff in", diff);
    let changedFiles = diff.split("\n");
    if (ignoreFilters.size) {
      for (const ignored of ignoreFilters) {
        changedFiles = changedFiles.filter(ignored);
      }
    }
    if (changedFiles.length) {
      import_npmlog6.default.verbose("filtered diff", changedFiles);
    } else {
      import_npmlog6.default.verbose("", "no diff found in %s (after filtering)", node.name);
    }
    return changedFiles.length > 0;
  };
}
function diffSinceIn(committish, location, opts) {
  const args = ["diff", "--name-only", committish];
  const formattedLocation = (0, import_slash.default)((0, import_path.relative)(opts.cwd, location));
  if (formattedLocation) {
    args.push("--", formattedLocation);
  }
  import_npmlog6.default.silly("checking diff", formattedLocation);
  return execSync2("git", args, opts);
}
var import_minimatch, import_npmlog6, import_path, import_slash, execSync2;
var init_make_diff_predicate = __esm({
  "libs/core/src/lib/collect-updates/make-diff-predicate.ts"() {
    "use strict";
    import_minimatch = __toESM(require("minimatch"));
    import_npmlog6 = __toESM(require("npmlog"));
    import_path = require("path");
    import_slash = __toESM(require("slash"));
    init_project_graph_with_packages();
    ({ execSync: execSync2 } = (init_src(), __toCommonJS(src_exports)));
  }
});

// libs/core/src/lib/collect-updates/collect-project-updates.ts
function collectProjectUpdates(filteredProjects, projectGraph, execOpts, commandOptions) {
  const {
    forcePublish,
    conventionalCommits,
    forceConventionalGraduate,
    conventionalGraduate,
    excludeDependents,
    tagVersionSeparator
  } = commandOptions;
  const useConventionalGraduate = conventionalCommits && (conventionalGraduate || forceConventionalGraduate);
  const forced = getPackagesForOption(useConventionalGraduate ? conventionalGraduate : forcePublish);
  let committish = commandOptions.since ?? "";
  if (hasTags(execOpts)) {
    const { sha, refCount, lastTagName } = describeRefSync(
      { ...execOpts, separator: tagVersionSeparator },
      commandOptions.includeMergedTags
    );
    if (refCount === "0" && forced.size === 0 && !committish) {
      import_npmlog7.default.notice("", "Current HEAD is already released, skipping change detection.");
      return [];
    }
    if (commandOptions.canary) {
      committish = `${sha}^..${sha}`;
    } else if (!committish) {
      committish = lastTagName;
    }
  }
  if (forced.size) {
    import_npmlog7.default.warn(
      useConventionalGraduate ? "conventional-graduate" : "force-publish",
      forced.has("*") ? "all packages" : Array.from(forced.values()).join("\n")
    );
  }
  if (useConventionalGraduate) {
    if (forced.has("*")) {
      import_npmlog7.default.info("", "Graduating all prereleased packages");
    } else {
      import_npmlog7.default.info("", "Graduating prereleased packages");
    }
  } else if (!committish || forced.has("*")) {
    import_npmlog7.default.info("", "Assuming all packages changed");
    return collectProjects(filteredProjects, projectGraph, {
      onInclude: (name) => import_npmlog7.default.verbose("updated", name),
      excludeDependents
    });
  }
  import_npmlog7.default.info("", `Looking for changed packages since ${committish}`);
  const hasDiff = makeDiffPredicate(committish, execOpts, commandOptions.ignoreChanges);
  const needsBump = !commandOptions.bump || commandOptions.bump.startsWith("pre") ? () => false : (
    /* skip packages that have not been previously prereleased */
    (node) => !!prereleaseIdFromVersion(getPackage(node).version)
  );
  const isForced = (node, name) => !!((forced.has("*") || forced.has(name)) && ((useConventionalGraduate ? prereleaseIdFromVersion(getPackage(node).version) : true) || forceConventionalGraduate));
  return collectProjects(filteredProjects, projectGraph, {
    isCandidate: (node, name) => isForced(node, name) || needsBump(node) || hasDiff(node),
    onInclude: (name) => import_npmlog7.default.verbose("updated", name),
    excludeDependents
  });
}
function collectProjects(projects, projectGraph, { isCandidate = () => true, onInclude, excludeDependents } = {}) {
  const candidates = {};
  projects.forEach((node) => {
    if (isCandidate(node, getPackage(node).name)) {
      candidates[node.name] = node;
    }
  });
  if (!excludeDependents) {
    collectDependents(candidates, projectGraph).forEach((node) => candidates[node.name] = node);
  }
  const updates = [];
  projects.forEach((node) => {
    if (candidates[node.name]) {
      if (onInclude) {
        onInclude(getPackage(node).name);
      }
      updates.push(node);
    }
  });
  return updates;
}
function collectDependents(nodes, projectGraph) {
  const dependents = (0, import_lodash2.flatten)(
    Object.values(projectGraph.localPackageDependencies)
  ).reduce(
    (prev, next) => ({
      ...prev,
      [next.target]: [...prev[next.target] || [], next.source]
    }),
    {}
  );
  const collected = /* @__PURE__ */ new Set();
  Object.values(nodes).forEach((currentNode) => {
    if (dependents[currentNode.name] && dependents[currentNode.name].length === 0) {
      return;
    }
    const queue2 = [currentNode];
    const seen = /* @__PURE__ */ new Set();
    while (queue2.length) {
      const node = queue2.shift();
      dependents[node.name]?.forEach((dep) => {
        if (seen.has(dep)) {
          return;
        }
        seen.add(dep);
        if (dep === currentNode.name || nodes[dep]) {
          return;
        }
        const dependentNode = projectGraph.nodes[dep];
        collected.add(dependentNode);
        queue2.push(dependentNode);
      });
    }
  });
  return collected;
}
var import_lodash2, import_npmlog7;
var init_collect_project_updates = __esm({
  "libs/core/src/lib/collect-updates/collect-project-updates.ts"() {
    "use strict";
    import_lodash2 = require("lodash");
    import_npmlog7 = __toESM(require("npmlog"));
    init_describe_ref();
    init_get_packages_for_option();
    init_prerelease_id_from_version();
    init_project_graph_with_packages();
    init_has_tags();
    init_make_diff_predicate();
  }
});

// libs/core/src/lib/collect-updates/index.ts
var init_collect_updates = __esm({
  "libs/core/src/lib/collect-updates/index.ts"() {
    "use strict";
    init_collect_project_updates();
  }
});

// libs/core/src/lib/package.ts
function binSafeName({ name, scope }) {
  return scope ? name.substring(scope.length + 1) : name;
}
function shallowCopy(json) {
  return Object.keys(json).reduce((obj, key) => {
    const val = json[key];
    if (Array.isArray(val)) {
      obj[key] = val.slice();
    } else if (val && typeof val === "object") {
      obj[key] = Object.assign({}, val);
    } else {
      obj[key] = val;
    }
    return obj;
  }, {});
}
var import_devkit, import_fs, import_load_json_file, import_npm_package_arg, import_path2, import_write_pkg, PKG, _location, _resolved, _rootPath, _scripts, _contents, Package;
var init_package = __esm({
  "libs/core/src/lib/package.ts"() {
    "use strict";
    import_devkit = require("@nx/devkit");
    import_fs = __toESM(require("fs"));
    import_load_json_file = __toESM(require("load-json-file"));
    import_npm_package_arg = __toESM(require("npm-package-arg"));
    import_path2 = __toESM(require("path"));
    import_write_pkg = __toESM(require("write-pkg"));
    PKG = Symbol("pkg");
    _location = Symbol("location");
    _resolved = Symbol("resolved");
    _rootPath = Symbol("rootPath");
    _scripts = Symbol("scripts");
    _contents = Symbol("contents");
    Package = class _Package {
      static {
        PKG, _location, _resolved, _rootPath, _scripts, _contents;
      }
      /**
       * Create a Package instance from parameters, possibly reusing existing instance.
       * @param ref A path to a package.json file, Package instance, or JSON object
       * @param [dir] If `ref` is a JSON object, this is the location of the manifest
       */
      static lazy(ref, dir = ".") {
        if (typeof ref === "string") {
          const location = import_path2.default.resolve(import_path2.default.basename(ref) === "package.json" ? import_path2.default.dirname(ref) : ref);
          const manifest = import_load_json_file.default.sync(import_path2.default.join(location, "package.json"));
          return new _Package(manifest, location);
        }
        if ("__isLernaPackage" in ref) {
          return ref;
        }
        return new _Package(ref, dir);
      }
      constructor(pkg, location, rootPath = location) {
        const resolved = import_npm_package_arg.default.resolve(pkg.name, `file:${import_path2.default.relative(rootPath, location)}`, rootPath);
        this.name = pkg.name;
        this[PKG] = pkg;
        Object.defineProperty(this, PKG, { enumerable: false, writable: true });
        this[_location] = location;
        this[_resolved] = resolved;
        this[_rootPath] = rootPath;
        this[_scripts] = { ...pkg.scripts };
      }
      // readonly getters
      get location() {
        return this[_location];
      }
      get private() {
        return Boolean(this[PKG].private);
      }
      set private(isPrivate) {
        this[PKG].private = isPrivate;
      }
      get resolved() {
        return this[_resolved];
      }
      get rootPath() {
        return this[_rootPath];
      }
      get scripts() {
        return this[_scripts];
      }
      get lernaConfig() {
        return this[PKG].lerna;
      }
      set lernaConfig(config) {
        this[PKG].lerna = config;
      }
      get bin() {
        const pkg = this[PKG];
        return typeof pkg.bin === "string" ? {
          // See note on function implementation
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          [binSafeName(this.resolved)]: pkg.bin
        } : Object.assign({}, pkg.bin);
      }
      get binLocation() {
        return import_path2.default.join(this.location, "node_modules", ".bin");
      }
      get manifestLocation() {
        return import_path2.default.join(this.location, "package.json");
      }
      get nodeModulesLocation() {
        return import_path2.default.join(this.location, "node_modules");
      }
      // eslint-disable-next-line class-methods-use-this
      get __isLernaPackage() {
        return true;
      }
      // accessors
      get version() {
        return this[PKG].version;
      }
      set version(version) {
        this[PKG].version = version;
      }
      get contents() {
        if (this[_contents]) {
          return this[_contents];
        }
        if (this[PKG].publishConfig && this[PKG].publishConfig.directory) {
          return import_path2.default.join(this.location, this[PKG].publishConfig.directory);
        }
        return this.location;
      }
      set contents(subDirectory) {
        const _workspaceRoot = process.env["NX_WORKSPACE_ROOT_PATH"] || import_devkit.workspaceRoot;
        if (subDirectory.startsWith(_workspaceRoot)) {
          this[_contents] = subDirectory;
          return;
        }
        this[_contents] = import_path2.default.join(this.location, subDirectory);
      }
      // "live" collections
      get dependencies() {
        return this[PKG].dependencies;
      }
      get devDependencies() {
        return this[PKG].devDependencies;
      }
      get optionalDependencies() {
        return this[PKG].optionalDependencies;
      }
      get peerDependencies() {
        return this[PKG].peerDependencies;
      }
      /**
       * Map-like retrieval of arbitrary values
       */
      get(key) {
        return this[PKG][key];
      }
      /**
       * Map-like storage of arbitrary values
       */
      set(key, val) {
        this[PKG][key] = val;
        return this;
      }
      /**
       * Provide shallow copy for munging elsewhere
       */
      toJSON() {
        return shallowCopy(this[PKG]);
      }
      /**
       * Refresh internal state from disk (e.g., changed by external lifecycles)
       */
      refresh() {
        return (0, import_load_json_file.default)(this.manifestLocation).then((pkg) => {
          this[PKG] = pkg;
          return this;
        });
      }
      /**
       * Write manifest changes to disk
       * @returns {Promise} resolves when write finished
       */
      serialize() {
        return (0, import_write_pkg.default)(this.manifestLocation, this[PKG]).then(() => this);
      }
      /**
       * Sync dist manifest version
       */
      async syncDistVersion(doSync) {
        if (doSync) {
          const distPkg = import_path2.default.join(this.contents, "package.json");
          if (distPkg !== this.manifestLocation && import_fs.default.existsSync(distPkg)) {
            const pkg = await (0, import_load_json_file.default)(distPkg);
            pkg.version = this[PKG].version;
            await (0, import_write_pkg.default)(distPkg, pkg);
          }
        }
        return this;
      }
      getLocalDependency(depName) {
        if (this.dependencies && this.dependencies[depName]) {
          return {
            collection: "dependencies",
            spec: this.dependencies[depName]
          };
        }
        if (this.devDependencies && this.devDependencies[depName]) {
          return {
            collection: "devDependencies",
            spec: this.devDependencies[depName]
          };
        }
        if (this.optionalDependencies && this.optionalDependencies[depName]) {
          return {
            collection: "optionalDependencies",
            spec: this.optionalDependencies[depName]
          };
        }
        return null;
      }
      /**
       * Mutate local dependency spec according to type
       * @param resolved npa metadata
       * @param depVersion semver
       * @param savePrefix npm_config_save_prefix
       */
      updateLocalDependency(resolved, depVersion, savePrefix, options = { retainWorkspacePrefix: true }) {
        const depName = resolved.name;
        let depCollection = this.dependencies;
        if (!depCollection || !depCollection[depName]) {
          depCollection = this.optionalDependencies;
        }
        if (!depCollection || !depCollection[depName]) {
          depCollection = this.devDependencies;
        }
        if (resolved.workspaceSpec && options.retainWorkspacePrefix) {
          if (!resolved.workspaceAlias) {
            const workspacePrefix = resolved.workspaceSpec.match(/^(workspace:[*~^]?)/)[0];
            depCollection[depName] = `${workspacePrefix}${depVersion}`;
          }
        } else if (resolved.registry || resolved.type === "directory") {
          depCollection[depName] = `${savePrefix}${depVersion}`;
        } else if (resolved.gitCommittish) {
          const [tagPrefix] = /^\D*/.exec(resolved.gitCommittish);
          const { hosted } = resolved;
          hosted.committish = `${tagPrefix}${depVersion}`;
          depCollection[depName] = hosted.toString({ noGitPlus: false, noCommittish: false });
        } else if (resolved.gitRange) {
          const { hosted } = resolved;
          hosted.committish = `semver:${savePrefix}${depVersion}`;
          depCollection[depName] = hosted.toString({ noGitPlus: false, noCommittish: false });
        }
      }
      /**
       * Remove the private property, effectively making the package public.
       */
      removePrivate() {
        delete this[PKG].private;
      }
    };
  }
});

// libs/core/src/lib/project/shallow-extend.ts
function shallowExtend(json, defaults = {}) {
  return Object.keys(json).reduce((obj, key) => {
    const val = json[key];
    if (Array.isArray(val)) {
      obj[key] = val.slice();
    } else if (val && typeof val === "object") {
      obj[key] = shallowExtend(val, obj[key]);
    } else {
      obj[key] = val;
    }
    return obj;
  }, defaults);
}
var init_shallow_extend = __esm({
  "libs/core/src/lib/project/shallow-extend.ts"() {
    "use strict";
  }
});

// libs/core/src/lib/project/apply-extends.ts
function applyExtends(config, cwd, seen = /* @__PURE__ */ new Set()) {
  let defaultConfig = {};
  if ("extends" in config) {
    let pathToDefault;
    try {
      pathToDefault = (0, import_resolve_from.default)(cwd, config.extends);
    } catch (err) {
      throw new ValidationError("ERESOLVED", "Config .extends must be locally-resolvable", err);
    }
    if (seen.has(pathToDefault)) {
      throw new ValidationError("ECIRCULAR", "Config .extends cannot be circular", seen);
    }
    seen.add(pathToDefault);
    defaultConfig = require(pathToDefault);
    delete config.extends;
    defaultConfig = applyExtends(defaultConfig, import_path3.default.dirname(pathToDefault), seen);
  }
  return shallowExtend(config, defaultConfig);
}
var import_path3, import_resolve_from;
var init_apply_extends = __esm({
  "libs/core/src/lib/project/apply-extends.ts"() {
    "use strict";
    import_path3 = __toESM(require("path"));
    import_resolve_from = __toESM(require("resolve-from"));
    init_validation_error();
    init_shallow_extend();
  }
});

// libs/core/src/lib/project/make-file-finder.ts
function normalize(results) {
  return results.map((fp) => import_path4.default.normalize(fp));
}
function getGlobOpts(rootPath, packageConfigs) {
  const globOpts = {
    cwd: rootPath,
    absolute: true,
    expandDirectories: false,
    followSymbolicLinks: false
  };
  if (packageConfigs.some((cfg) => cfg.indexOf("**") > -1)) {
    if (packageConfigs.some((cfg) => cfg.indexOf("node_modules") > -1)) {
      throw new ValidationError(
        "EPKGCONFIG",
        "An explicit node_modules package path does not allow globstars (**)"
      );
    }
    globOpts.ignore = [
      // allow globs like "packages/**",
      // but avoid picking up node_modules/**/package.json
      "**/node_modules/**"
    ];
  }
  return globOpts;
}
function makeFileFinder(rootPath, packageConfigs) {
  const globOpts = getGlobOpts(rootPath, packageConfigs);
  return (fileName, fileMapper, customGlobOpts) => {
    const options = Object.assign({}, customGlobOpts, globOpts);
    const promise = (0, import_p_map.default)(
      Array.from(packageConfigs).sort(),
      (globPath) => {
        let chain = (0, import_globby.default)(import_path4.default.posix.join(globPath, fileName), options);
        chain = chain.then((results) => results.sort());
        chain = chain.then(normalize);
        if (fileMapper) {
          chain = chain.then(fileMapper);
        }
        return chain;
      },
      { concurrency: 4 }
    );
    return promise.then((results) => results.reduce((acc, result) => acc.concat(result), []));
  };
}
function makeSyncFileFinder(rootPath, packageConfigs) {
  const globOpts = getGlobOpts(rootPath, packageConfigs);
  return (fileName, fileMapper) => {
    const patterns = packageConfigs.map((globPath) => import_path4.default.posix.join(globPath, fileName)).sort();
    let results = import_globby.default.sync(patterns, globOpts);
    results = normalize(results);
    return results.map((res) => fileMapper(res));
  };
}
var import_globby, import_p_map, import_path4;
var init_make_file_finder = __esm({
  "libs/core/src/lib/project/make-file-finder.ts"() {
    "use strict";
    import_globby = __toESM(require("globby"));
    import_p_map = __toESM(require("p-map"));
    import_path4 = __toESM(require("path"));
    init_validation_error();
  }
});

// libs/core/src/lib/project/index.ts
var import_devkit2, import_cosmiconfig, import_dedent2, import_fs2, import_glob_parent, import_globby2, import_js_yaml, import_load_json_file2, import_npmlog8, import_p_map2, import_path5, LICENSE_GLOB, Project, getPackages, getPackagesSync;
var init_project = __esm({
  "libs/core/src/lib/project/index.ts"() {
    "use strict";
    import_devkit2 = require("@nx/devkit");
    import_cosmiconfig = require("cosmiconfig");
    import_dedent2 = __toESM(require("dedent"));
    import_fs2 = __toESM(require("fs"));
    import_glob_parent = __toESM(require("glob-parent"));
    import_globby2 = __toESM(require("globby"));
    import_js_yaml = require("js-yaml");
    import_load_json_file2 = __toESM(require("load-json-file"));
    import_npmlog8 = __toESM(require("npmlog"));
    import_p_map2 = __toESM(require("p-map"));
    import_path5 = __toESM(require("path"));
    init_package();
    init_validation_error();
    init_apply_extends();
    init_make_file_finder();
    LICENSE_GLOB = "LICEN{S,C}E{,.*}";
    Project = class _Project {
      /**
       * @deprecated Only used in legacy core utilities
       * TODO: remove in v8
       */
      static getPackages(cwd) {
        return new _Project(cwd).getPackages();
      }
      /**
       * @deprecated Only used in legacy core utilities
       * TODO: remove in v8
       */
      static getPackagesSync(cwd) {
        return new _Project(cwd).getPackagesSync();
      }
      constructor(cwd, options) {
        const { config, configNotFound, filepath } = this.#resolveLernaConfig(cwd);
        this.config = config;
        this.configNotFound = configNotFound || false;
        this.rootConfigLocation = filepath;
        this.rootPath = import_path5.default.dirname(filepath);
        this.manifest = this.#resolveRootPackageJson();
        if (this.configNotFound) {
          throw new ValidationError("ENOLERNA", "`lerna.json` does not exist, have you run `lerna init`?");
        }
        if (!options?.skipLernaConfigValidations) {
          this.#validateLernaConfig(config);
        }
        this.packageConfigs = this.#resolvePackageConfigs();
        import_npmlog8.default.verbose("rootPath", this.rootPath);
      }
      get version() {
        return this.config.version;
      }
      set version(val) {
        this.config.version = val;
      }
      get packageParentDirs() {
        return this.packageConfigs.map((packagePattern) => (0, import_glob_parent.default)(packagePattern)).map((parentDir) => import_path5.default.resolve(this.rootPath, parentDir));
      }
      get licensePath() {
        let licensePath;
        try {
          const search = import_globby2.default.sync(LICENSE_GLOB, {
            cwd: this.rootPath,
            absolute: true,
            caseSensitiveMatch: false,
            // Project license is always a sibling of the root manifest
            deep: 0
          });
          licensePath = search.shift();
          if (licensePath) {
            licensePath = import_path5.default.normalize(licensePath);
            Object.defineProperty(this, "licensePath", {
              value: licensePath
            });
          }
        } catch (err) {
          throw new ValidationError(err.name, err.message);
        }
        return licensePath;
      }
      get fileFinder() {
        const finder = makeFileFinder(this.rootPath, this.packageConfigs);
        Object.defineProperty(this, "fileFinder", {
          value: finder
        });
        return finder;
      }
      /**
       * A promise resolving to a list of Package instances
       */
      getPackages() {
        const mapper = (packageConfigPath) => (0, import_load_json_file2.default)(packageConfigPath).then(
          (packageJson) => new Package(packageJson, import_path5.default.dirname(packageConfigPath), this.rootPath)
        );
        return this.fileFinder("package.json", (filePaths) => (0, import_p_map2.default)(filePaths, mapper, { concurrency: 50 }));
      }
      /**
       * A list of Package instances
       */
      getPackagesSync() {
        const syncFileFinder = makeSyncFileFinder(this.rootPath, this.packageConfigs);
        return syncFileFinder("package.json", (packageConfigPath) => {
          return new Package(
            import_load_json_file2.default.sync(packageConfigPath),
            import_path5.default.dirname(packageConfigPath),
            this.rootPath
          );
        });
      }
      getPackageLicensePaths() {
        return this.fileFinder(LICENSE_GLOB, null, { caseSensitiveMatch: false });
      }
      isIndependent() {
        return this.version === "independent";
      }
      serializeConfig() {
        (0, import_devkit2.writeJsonFile)(this.rootConfigLocation, this.config, { spaces: 2 });
        return this.rootConfigLocation;
      }
      #resolveRootPackageJson() {
        try {
          const manifestLocation = import_path5.default.join(this.rootPath, "package.json");
          const packageJson = import_load_json_file2.default.sync(manifestLocation);
          if (!packageJson.name) {
            packageJson.name = import_path5.default.basename(import_path5.default.dirname(manifestLocation));
          }
          return new Package(packageJson, this.rootPath);
        } catch (err) {
          if (err instanceof Error && err?.name === "JSONError") {
            throw new ValidationError(err.name, err.message);
          }
          throw new ValidationError("ENOPKG", "`package.json` does not exist, have you run `lerna init`?");
        }
      }
      #resolveLernaConfig(cwd) {
        try {
          const explorer = (0, import_cosmiconfig.cosmiconfigSync)("lerna", {
            loaders: {
              ...import_cosmiconfig.defaultLoaders,
              ".json": (filepath, content) => {
                if (!filepath.endsWith("lerna.json")) {
                  return import_cosmiconfig.defaultLoaders[".json"](filepath, content);
                }
                try {
                  return (0, import_devkit2.parseJson)(content);
                } catch (err) {
                  if (err instanceof Error) {
                    err.name = "JSONError";
                    err.message = `Error in: ${filepath}
${err.message}`;
                  }
                  throw err;
                }
              }
            },
            searchPlaces: ["lerna.json", "package.json"],
            transform(obj) {
              if (!obj) {
                const configNotFoundResult = {
                  // No need to distinguish between missing and empty,
                  // saves a lot of noisy guards elsewhere
                  config: {},
                  configNotFound: true,
                  // path.resolve(".", ...) starts from process.cwd()
                  filepath: import_path5.default.resolve(cwd || ".", "lerna.json")
                };
                return configNotFoundResult;
              }
              obj.config = applyExtends(obj.config, import_path5.default.dirname(obj.filepath));
              return obj;
            }
          });
          return explorer.search(cwd);
        } catch (err) {
          if (err.name === "JSONError") {
            throw new ValidationError(err.name, err.message);
          }
          throw err;
        }
      }
      #validateLernaConfig(config) {
        if (!this.version) {
          throw new ValidationError("ENOVERSION", "Required property version does not exist in `lerna.json`");
        }
        if (config.useWorkspaces !== void 0) {
          throw new ValidationError(
            "ECONFIGWORKSPACES",
            `The "useWorkspaces" option has been removed. By default lerna will resolve your packages using your package manager's workspaces configuration. Alternatively, you can manually provide a list of package globs to be used instead via the "packages" option in lerna.json.`
          );
        }
      }
      #resolvePnpmWorkspaceConfig() {
        let config;
        try {
          const configLocation = import_path5.default.join(this.rootPath, "pnpm-workspace.yaml");
          const configContent = import_fs2.default.readFileSync(configLocation, { encoding: "utf8" });
          config = (0, import_js_yaml.load)(configContent);
        } catch (err) {
          if (err.message.includes("ENOENT: no such file or directory")) {
            throw new ValidationError(
              "ENOENT",
              "No pnpm-workspace.yaml found. See https://pnpm.io/workspaces for help configuring workspaces in pnpm."
            );
          }
          throw new ValidationError(err.name, err.message);
        }
        return config;
      }
      /**
       * By default, the user's package manager workspaces configuration will be used to resolve packages.
       * However, they can optionally specify an explicit set of package globs to be used instead.
       *
       * NOTE: This does not impact the project graph creation process, which will still ultimately use
       * the package manager workspaces configuration to construct a full graph, it will only impact which
       * of the packages in that graph will be considered when running commands.
       */
      #resolvePackageConfigs() {
        if (this.config.packages) {
          import_npmlog8.default.verbose(
            "packageConfigs",
            `Explicit "packages" configuration found in lerna.json. Resolving packages using the configured glob(s): ${JSON.stringify(
              this.config.packages
            )}`
          );
          return this.config.packages;
        }
        if (this.config.npmClient === "pnpm") {
          import_npmlog8.default.verbose(
            "packageConfigs",
            'Package manager "pnpm" detected. Resolving packages using `pnpm-workspace.yaml`.'
          );
          const workspaces2 = this.#resolvePnpmWorkspaceConfig().packages;
          if (!workspaces2) {
            throw new ValidationError(
              "EWORKSPACES",
              'No "packages" property found in `pnpm-workspace.yaml`. See https://pnpm.io/workspaces for help configuring workspaces in pnpm.'
            );
          }
          return workspaces2;
        }
        const workspaces = this.manifest?.get("workspaces");
        const isYarnClassicWorkspacesObjectConfig = Boolean(
          workspaces && typeof workspaces === "object" && Array.isArray(workspaces.packages)
        );
        const isValidWorkspacesConfig = Array.isArray(workspaces) || isYarnClassicWorkspacesObjectConfig;
        if (!workspaces || !isValidWorkspacesConfig) {
          throw new ValidationError(
            "EWORKSPACES",
            import_dedent2.default`
          Lerna is expecting to able to resolve the "workspaces" configuration from your package manager in order to determine what packages to work on, but no "workspaces" config was found.
          (A) Did you mean to specify a "packages" config manually in lerna.json instead of using your workspaces config?
          (B) Alternatively, if you are using pnpm as your package manager, make sure you set "npmClient": "pnpm" in your lerna.json so that lerna knows to read from the "pnpm-workspace.yaml" file instead of package.json.
          See: https://lerna.js.org/docs/getting-started
        `
          );
        }
        import_npmlog8.default.verbose("packageConfigs", `Resolving packages based on package.json "workspaces" configuration.`);
        if (isYarnClassicWorkspacesObjectConfig) {
          return workspaces.packages;
        }
        return workspaces;
      }
    };
    getPackages = Project.getPackages;
    getPackagesSync = Project.getPackagesSync;
  }
});

// libs/core/src/lib/write-log-file.ts
function writeLogFile(cwd) {
  let logOutput = "";
  import_npmlog9.default.record.forEach((m) => {
    let pref = [m.id, m.level];
    if (m.prefix) {
      pref.push(m.prefix);
    }
    pref = pref.join(" ");
    m.message.trim().split(/\r?\n/).map((line) => `${pref} ${line}`.trim()).forEach((line) => {
      logOutput += line + import_os2.default.EOL;
    });
  });
  import_write_file_atomic.default.sync(import_path6.default.join(cwd, "lerna-debug.log"), logOutput);
  import_npmlog9.default.record.length = 0;
}
var import_npmlog9, import_os2, import_path6, import_write_file_atomic;
var init_write_log_file = __esm({
  "libs/core/src/lib/write-log-file.ts"() {
    "use strict";
    import_npmlog9 = __toESM(require("npmlog"));
    import_os2 = __toESM(require("os"));
    import_path6 = __toESM(require("path"));
    import_write_file_atomic = __toESM(require("write-file-atomic"));
  }
});

// libs/core/src/lib/command/clean-stack.ts
function cleanStack(err, className) {
  const lines = isErrorWithStack(err) ? err.stack.split("\n") : String(err).split("\n");
  const cutoff = new RegExp(`^    at ${className}.runCommand .*$`);
  const relevantIndex = lines.findIndex((line) => cutoff.test(line));
  if (relevantIndex) {
    return lines.slice(0, relevantIndex).join("\n");
  }
  return err.toString();
}
function isErrorWithStack(err) {
  return err.stack !== void 0;
}
var init_clean_stack = __esm({
  "libs/core/src/lib/command/clean-stack.ts"() {
    "use strict";
  }
});

// libs/core/src/lib/command/default-options.ts
function defaultOptions(...sources) {
  const options = {};
  for (const source of sources) {
    if (source != null) {
      for (const key of Object.keys(source)) {
        if (options[key] === void 0) {
          options[key] = source[key];
        }
      }
    }
  }
  return options;
}
var init_default_options = __esm({
  "libs/core/src/lib/command/default-options.ts"() {
    "use strict";
  }
});

// libs/core/src/lib/get-package-manifest-path.ts
function getPackageManifestPath(node, files) {
  const pkgJsonPath = (0, import_path7.resolve)((0, import_path7.join)(node.data.root, "package.json"));
  return files.find((f) => (0, import_path7.resolve)(f.file) === pkgJsonPath)?.file;
}
var import_path7;
var init_get_package_manifest_path = __esm({
  "libs/core/src/lib/get-package-manifest-path.ts"() {
    "use strict";
    import_path7 = require("path");
  }
});

// libs/core/src/lib/command/create-project-graph-with-packages.ts
async function createProjectGraphWithPackages(projectGraph, projectFileMap, packageConfigs) {
  const _workspaceRoot = process.env["NX_WORKSPACE_ROOT_PATH"] || import_devkit3.workspaceRoot;
  const projectNodes = Object.values(projectGraph.nodes);
  const projectNodesMatchingPackageConfigs = projectNodes.filter((node) => {
    const matchesRootPath = (config) => (0, import_minimatch2.default)(node.data.root, config);
    return packageConfigs.some(matchesRootPath);
  });
  const tuples = await Promise.all(
    projectNodesMatchingPackageConfigs.map(
      (node) => new Promise((resolve3) => {
        const manifestPath = getPackageManifestPath(node, projectFileMap[node.name] || []);
        if (manifestPath) {
          const fullManifestPath = (0, import_path8.join)(_workspaceRoot, manifestPath);
          resolve3((0, import_fs_extra.readJson)(fullManifestPath).then((manifest) => [node, manifest]));
        } else {
          resolve3([node, null]);
        }
      })
    )
  );
  const projectGraphWithOrderedNodes = {
    ...projectGraph,
    nodes: {},
    localPackageDependencies: {}
  };
  const projectLookupByPackageName = {};
  const sortedTuples = (0, import_lodash3.sortBy)(tuples, (t) => t[0].data.root);
  sortedTuples.forEach(([node, manifest]) => {
    let pkg = null;
    if (manifest) {
      pkg = new Package(manifest, (0, import_path8.join)(_workspaceRoot, node.data.root), _workspaceRoot);
      projectLookupByPackageName[pkg.name] = node.name;
    }
    projectGraphWithOrderedNodes.nodes[node.name] = {
      ...node,
      package: pkg
    };
  });
  projectGraphWithOrderedNodes.dependencies = (0, import_lodash3.reduce)(
    (0, import_lodash3.sortBy)(Object.keys(projectGraphWithOrderedNodes.dependencies)),
    (prev, next) => ({ ...prev, [next]: projectGraphWithOrderedNodes.dependencies[next] }),
    {}
  );
  Object.values(projectGraphWithOrderedNodes.dependencies).forEach((projectDeps) => {
    const workspaceDeps = projectDeps.filter(
      (dep) => !isExternalNpmDependency(dep.target) && !isExternalNpmDependency(dep.source)
    );
    for (const dep of workspaceDeps) {
      const source = projectGraphWithOrderedNodes.nodes[dep.source];
      const target = projectGraphWithOrderedNodes.nodes[dep.target];
      if (!source || !source.package || !target || !target.package) {
        continue;
      }
      const sourcePkg = getPackage(source);
      const targetPkg = getPackage(target);
      const sourceNpmDependency = sourcePkg.getLocalDependency(targetPkg.name);
      if (!sourceNpmDependency) {
        continue;
      }
      const workspaceDep = dep;
      const resolvedTarget = resolvePackage(
        targetPkg.name,
        targetPkg.version,
        sourceNpmDependency.spec,
        sourcePkg.location
      );
      const targetMatchesRequirement = resolvedTarget.fetchSpec === targetPkg.location || (0, import_semver2.satisfies)(
        targetPkg.version,
        resolvedTarget.gitCommittish || resolvedTarget.gitRange || resolvedTarget.fetchSpec
      );
      workspaceDep.dependencyCollection = sourceNpmDependency.collection;
      workspaceDep.targetResolvedNpaResult = resolvedTarget;
      workspaceDep.targetVersionMatchesDependencyRequirement = targetMatchesRequirement;
      if (workspaceDep.targetVersionMatchesDependencyRequirement) {
        projectGraphWithOrderedNodes.localPackageDependencies[dep.source] = [
          ...projectGraphWithOrderedNodes.localPackageDependencies[dep.source] || [],
          workspaceDep
        ];
      }
    }
  });
  return projectGraphWithOrderedNodes;
}
var import_devkit3, import_fs_extra, import_lodash3, import_minimatch2, import_npm_package_arg2, import_path8, import_semver2, resolvePackage;
var init_create_project_graph_with_packages = __esm({
  "libs/core/src/lib/command/create-project-graph-with-packages.ts"() {
    "use strict";
    import_devkit3 = require("@nx/devkit");
    import_fs_extra = require("fs-extra");
    import_lodash3 = require("lodash");
    import_minimatch2 = __toESM(require("minimatch"));
    import_npm_package_arg2 = require("npm-package-arg");
    import_path8 = require("path");
    import_semver2 = require("semver");
    init_get_package_manifest_path();
    init_package();
    init_project_graph_with_packages();
    resolvePackage = (name, version, spec, location) => {
      spec = spec.replace(/^link:/, "file:");
      const isWorkspaceSpec = /^workspace:/.test(spec);
      let fullWorkspaceSpec;
      let workspaceAlias;
      if (isWorkspaceSpec) {
        fullWorkspaceSpec = spec;
        spec = spec.replace(/^workspace:/, "");
        if (spec === "*" || spec === "^" || spec === "~") {
          workspaceAlias = spec;
          if (version) {
            const prefix = spec === "*" ? "" : spec;
            spec = `${prefix}${version}`;
          } else {
            spec = "*";
          }
        }
      }
      const resolved = (0, import_npm_package_arg2.resolve)(name, spec, location);
      resolved.workspaceSpec = fullWorkspaceSpec;
      resolved.workspaceAlias = workspaceAlias;
      return resolved;
    };
  }
});

// libs/core/src/lib/command/detect-projects.ts
async function detectProjects(packageConfigs) {
  const _projectGraph = await (0, import_devkit4.createProjectGraphAsync)();
  const projectFileMap = await (0, import_devkit4.createProjectFileMapUsingProjectGraph)(_projectGraph);
  const projectGraph = await createProjectGraphWithPackages(_projectGraph, projectFileMap, packageConfigs);
  return {
    projectGraph,
    projectFileMap
  };
}
var import_devkit4;
var init_detect_projects = __esm({
  "libs/core/src/lib/command/detect-projects.ts"() {
    "use strict";
    import_devkit4 = require("@nx/devkit");
    init_create_project_graph_with_packages();
  }
});

// libs/core/src/lib/command/is-git-initialized.ts
function isGitInitialized(cwd) {
  const opts = {
    cwd,
    // don't throw, just want boolean
    reject: false,
    // only return code, no stdio needed
    stdio: "ignore"
  };
  return import_execa2.default.sync("git", ["rev-parse"], opts).exitCode === 0;
}
var import_execa2;
var init_is_git_initialized = __esm({
  "libs/core/src/lib/command/is-git-initialized.ts"() {
    "use strict";
    import_execa2 = __toESM(require("execa"));
  }
});

// libs/core/src/lib/command/log-package-error.ts
function logPackageError(err, stream = false) {
  import_npmlog10.default.error(err.command, `exited ${err.exitCode} in '${err.pkg.name}'`);
  if (stream) {
    return;
  }
  if (err.stdout) {
    import_npmlog10.default.error(err.command, "stdout:");
    directLog(err.stdout);
  }
  if (err.stderr) {
    import_npmlog10.default.error(err.command, "stderr:");
    directLog(err.stderr);
  }
  import_npmlog10.default.error(err.command, `exited ${err.exitCode} in '${err.pkg.name}'`);
}
function directLog(message) {
  import_npmlog10.default.pause();
  console.error(message);
  import_npmlog10.default.resume();
}
var import_npmlog10;
var init_log_package_error = __esm({
  "libs/core/src/lib/command/log-package-error.ts"() {
    "use strict";
    import_npmlog10 = __toESM(require("npmlog"));
  }
});

// libs/core/src/lib/command/warn-if-hanging.ts
function warnIfHanging() {
  const childProcessCount = childProcess4.getChildProcessCount();
  if (childProcessCount > 0) {
    import_npmlog11.default.warn(
      "complete",
      `Waiting for ${childProcessCount} child process${childProcessCount === 1 ? "" : "es"} to exit. CTRL-C to exit immediately.`
    );
  }
}
var import_npmlog11, childProcess4;
var init_warn_if_hanging = __esm({
  "libs/core/src/lib/command/warn-if-hanging.ts"() {
    "use strict";
    import_npmlog11 = __toESM(require("npmlog"));
    childProcess4 = (init_src(), __toCommonJS(src_exports));
  }
});

// libs/core/src/lib/command/index.ts
var import_clone_deep, import_dedent3, import_npmlog12, import_client, import_os3, DEFAULT_CONCURRENCY, Command;
var init_command = __esm({
  "libs/core/src/lib/command/index.ts"() {
    "use strict";
    import_clone_deep = __toESM(require("clone-deep"));
    import_dedent3 = __toESM(require("dedent"));
    import_npmlog12 = __toESM(require("npmlog"));
    import_client = require("nx/src/daemon/client/client");
    import_os3 = __toESM(require("os"));
    init_project();
    init_validation_error();
    init_write_log_file();
    init_clean_stack();
    init_default_options();
    init_detect_projects();
    init_is_git_initialized();
    init_log_package_error();
    init_warn_if_hanging();
    DEFAULT_CONCURRENCY = import_os3.default.cpus().length;
    Command = class _Command {
      constructor(_argv, {
        skipValidations,
        preInitializedProjectData
      } = { skipValidations: false }) {
        this.options = {};
        this.concurrency = 0;
        this.toposort = false;
        this.execOpts = {};
        this.argv = {};
        import_npmlog12.default.pause();
        import_npmlog12.default.heading = "lerna";
        const argv = (0, import_clone_deep.default)(_argv);
        import_npmlog12.default.silly("argv", argv);
        this.name = this.constructor.name.replace(/Command$/, "").toLowerCase();
        this.composed = typeof argv.composed === "string" && argv.composed !== this.name;
        if (!this.composed) {
          import_npmlog12.default.notice("cli", `v${argv.lernaVersion}`);
        }
        let runner = new Promise((resolve3, reject) => {
          let chain = Promise.resolve();
          chain = chain.then(() => {
            this.project = new Project(argv.cwd, { skipLernaConfigValidations: skipValidations });
          });
          chain = chain.then(() => this.configureEnvironment());
          chain = chain.then(() => this.configureOptions());
          chain = chain.then(() => this.configureProperties());
          chain = chain.then(() => {
            this.logger = _Command.createLogger(this.name, this.options.loglevel);
          });
          if (!skipValidations) {
            chain = chain.then(() => this.runValidations());
          }
          chain = chain.then(() => {
            if (preInitializedProjectData) {
              this.projectFileMap = preInitializedProjectData.projectFileMap;
              this.projectGraph = preInitializedProjectData.projectGraph;
              return;
            }
            return this.detectProjects();
          });
          chain = chain.then(() => this.runPreparations());
          chain = chain.then(() => this.runCommand());
          chain.then(
            (result) => {
              warnIfHanging();
              import_client.daemonClient.reset();
              resolve3(result);
            },
            (err) => {
              if (err.pkg) {
                logPackageError(err, this.options.stream);
              } else if (err.name !== "ValidationError") {
                import_npmlog12.default.error("", cleanStack(err, this.constructor.name));
              }
              if (err.name !== "ValidationError" && !err.pkg) {
                writeLogFile(this.project.rootPath);
              }
              warnIfHanging();
              import_client.daemonClient.reset();
              reject(err);
            }
          );
        });
        if (argv.onResolved || argv.onRejected) {
          runner = runner.then(argv.onResolved, argv.onRejected);
          delete argv.onResolved;
          delete argv.onRejected;
        }
        for (const key of ["cwd", "$0"]) {
          Object.defineProperty(argv, key, { enumerable: false });
        }
        Object.defineProperty(this, "argv", {
          value: Object.freeze(argv)
        });
        this.runner = runner;
      }
      get project() {
        if (this._project === void 0) {
          throw new ValidationError("ENOPROJECT", "Lerna Project not initialized!");
        }
        return this._project;
      }
      set project(project) {
        this._project = project;
      }
      static createLogger(name, loglevel) {
        if (loglevel) {
          import_npmlog12.default.level = loglevel;
        }
        import_npmlog12.default.addLevel("success", 3001, { fg: "green", bold: true });
        import_npmlog12.default.resume();
        return import_npmlog12.default["newGroup"](name);
      }
      // proxy "Promise" methods to "private" instance
      then(onResolved, onRejected) {
        return this.runner.then(onResolved, onRejected);
      }
      /* istanbul ignore next */
      catch(onRejected) {
        return this.runner.catch(onRejected);
      }
      get requiresGit() {
        return true;
      }
      // Override this to inherit config from another command.
      // For example `changed` inherits config from `publish`.
      get otherCommandConfigs() {
        return [];
      }
      async detectProjects() {
        const { projectGraph, projectFileMap } = await detectProjects(this.project.packageConfigs);
        this.projectGraph = projectGraph;
        this.projectFileMap = projectFileMap;
      }
      configureEnvironment() {
        const ci = require("is-ci");
        let loglevel;
        let progress;
        if (ci || !process.stderr.isTTY) {
          import_npmlog12.default.disableColor();
          progress = false;
        } else if (!process.stdout.isTTY) {
          progress = false;
          loglevel = "error";
        } else if (process.stderr.isTTY) {
          import_npmlog12.default.enableColor();
          import_npmlog12.default.enableUnicode();
        }
        Object.defineProperty(this, "envDefaults", {
          value: {
            ci,
            progress,
            loglevel
          }
        });
      }
      configureOptions() {
        const commandConfig = this.project.config.command || {};
        const overrides = [this.name, ...this.otherCommandConfigs].map((key) => commandConfig[key]);
        this.options = defaultOptions(
          // CLI flags, which if defined overrule subsequent values
          this.argv,
          ...overrides,
          // Global options from `lerna.json`
          this.project.config,
          // Environmental defaults prepared in previous step
          this.envDefaults
        );
        if (this.options.verbose && this.options.loglevel !== "silly") {
          this.options.loglevel = "verbose";
        }
      }
      configureProperties() {
        const { concurrency = 0, sort, maxBuffer } = this.options;
        this.concurrency = Math.max(1, +concurrency || DEFAULT_CONCURRENCY);
        this.toposort = sort === void 0 || sort;
        this.execOpts = {
          cwd: this.project.rootPath,
          maxBuffer
        };
      }
      enableProgressBar() {
        if (this.options.progress !== false) {
          import_npmlog12.default.enableProgress();
        }
      }
      runValidations() {
        if ((this.options.since !== void 0 || this.requiresGit) && !isGitInitialized(this.project.rootPath)) {
          throw new ValidationError(
            "ENOGIT",
            "The git binary was not found, this is not a git repository, or you git doesn't have the right ownership. Run `git rev-parse` to get more details."
          );
        }
        if (this.options.independent && !this.project.isIndependent()) {
          throw new ValidationError(
            "EVERSIONMODE",
            import_dedent3.default`
          You ran lerna with --independent or -i, but the repository is not set to independent mode.
          To use independent mode you need to set lerna.json's "version" property to "independent".
          Then you won't need to pass the --independent or -i flags.
        `
          );
        }
      }
      runPreparations() {
        if (!this.composed && this.project.isIndependent()) {
          import_npmlog12.default.info("versioning", "independent");
        }
        if (!this.composed && this.options.ci) {
          import_npmlog12.default.info("ci", "enabled");
        }
      }
      async runCommand() {
        const proceed = await this.initialize();
        if (proceed !== false) {
          return this.execute();
        }
        return void 0;
      }
      initialize() {
        throw new ValidationError(this.name, "initialize() needs to be implemented.");
      }
      /**
       * The execute() method can return a value in some cases (e.g. on the version command)
       */
      execute() {
        throw new ValidationError(this.name, "execute() needs to be implemented.");
      }
    };
  }
});

// libs/core/src/lib/conventional-commits/apply-build-metadata.ts
var init_apply_build_metadata = __esm({
  "libs/core/src/lib/conventional-commits/apply-build-metadata.ts"() {
    "use strict";
    init_validation_error();
  }
});

// libs/core/src/lib/conventional-commits/get-changelog-config.ts
var import_npm_package_arg3, import_npmlog13, import_pify;
var init_get_changelog_config = __esm({
  "libs/core/src/lib/conventional-commits/get-changelog-config.ts"() {
    "use strict";
    import_npm_package_arg3 = __toESM(require("npm-package-arg"));
    import_npmlog13 = __toESM(require("npmlog"));
    import_pify = __toESM(require("pify"));
    init_validation_error();
  }
});

// libs/core/src/lib/conventional-commits/recommend-version.ts
var import_conventional_recommended_bump, import_npmlog14, import_semver3;
var init_recommend_version = __esm({
  "libs/core/src/lib/conventional-commits/recommend-version.ts"() {
    "use strict";
    import_conventional_recommended_bump = __toESM(require("conventional-recommended-bump"));
    import_npmlog14 = __toESM(require("npmlog"));
    import_semver3 = __toESM(require("semver"));
    init_apply_build_metadata();
    init_get_changelog_config();
  }
});

// libs/core/src/lib/conventional-commits/constants.ts
var EOL, BLANK_LINE, COMMIT_GUIDELINE, CHANGELOG_HEADER;
var init_constants = __esm({
  "libs/core/src/lib/conventional-commits/constants.ts"() {
    "use strict";
    EOL = "\n";
    BLANK_LINE = EOL + EOL;
    COMMIT_GUIDELINE = "See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.";
    CHANGELOG_HEADER = [
      "# Change Log",
      "",
      "All notable changes to this project will be documented in this file.",
      COMMIT_GUIDELINE
    ].join(EOL);
  }
});

// libs/core/src/lib/conventional-commits/make-bump-only-filter.ts
var init_make_bump_only_filter = __esm({
  "libs/core/src/lib/conventional-commits/make-bump-only-filter.ts"() {
    "use strict";
    init_constants();
  }
});

// libs/core/src/lib/conventional-commits/read-existing-changelog.ts
var import_fs_extra2;
var init_read_existing_changelog = __esm({
  "libs/core/src/lib/conventional-commits/read-existing-changelog.ts"() {
    "use strict";
    import_fs_extra2 = __toESM(require("fs-extra"));
    init_constants();
  }
});

// libs/core/src/lib/conventional-commits/update-changelog.ts
var import_conventional_changelog_core, import_fs_extra3, import_get_stream, import_npmlog15;
var init_update_changelog = __esm({
  "libs/core/src/lib/conventional-commits/update-changelog.ts"() {
    "use strict";
    import_conventional_changelog_core = __toESM(require("conventional-changelog-core"));
    import_fs_extra3 = __toESM(require("fs-extra"));
    import_get_stream = __toESM(require("get-stream"));
    import_npmlog15 = __toESM(require("npmlog"));
    init_constants();
    init_get_changelog_config();
    init_make_bump_only_filter();
    init_read_existing_changelog();
  }
});

// libs/core/src/lib/conventional-commits/index.ts
var init_conventional_commits = __esm({
  "libs/core/src/lib/conventional-commits/index.ts"() {
    "use strict";
    init_recommend_version();
    init_update_changelog();
    init_apply_build_metadata();
  }
});

// libs/core/src/lib/corepack/is-corepack-enabled.ts
var init_is_corepack_enabled = __esm({
  "libs/core/src/lib/corepack/is-corepack-enabled.ts"() {
    "use strict";
  }
});

// libs/core/src/lib/corepack/exec-package-manager.ts
var childProcess5;
var init_exec_package_manager = __esm({
  "libs/core/src/lib/corepack/exec-package-manager.ts"() {
    "use strict";
    init_is_corepack_enabled();
    childProcess5 = (init_src(), __toCommonJS(src_exports));
  }
});

// libs/core/src/lib/corepack/index.ts
var init_corepack = __esm({
  "libs/core/src/lib/corepack/index.ts"() {
    "use strict";
    init_exec_package_manager();
  }
});

// libs/core/src/lib/filter-options.ts
function filterOptions(yargs2) {
  const opts = {
    scope: {
      describe: "Include only packages with names matching the given glob.",
      type: "string",
      requiresArg: true
    },
    ignore: {
      describe: "Exclude packages with names matching the given glob.",
      type: "string",
      requiresArg: true
    },
    "no-private": {
      describe: 'Exclude packages with { "private": true } in their package.json.',
      type: "boolean"
    },
    private: {
      // proxy for --no-private
      hidden: true,
      type: "boolean"
    },
    since: {
      describe: import_dedent4.default`
        Only include packages that have been changed since the specified [ref].
        If no ref is passed, it defaults to the most-recent tag.
      `,
      type: "string"
    },
    "exclude-dependents": {
      describe: import_dedent4.default`
        Exclude all transitive dependents when running a command
        with --since, overriding the default "changed" algorithm.
      `,
      conflicts: "include-dependents",
      type: "boolean"
    },
    "include-dependents": {
      describe: import_dedent4.default`
        Include all transitive dependents when running a command
        regardless of --scope, --ignore, or --since.
      `,
      conflicts: "exclude-dependents",
      type: "boolean"
    },
    "include-dependencies": {
      describe: import_dedent4.default`
        Include all transitive dependencies when running a command
        regardless of --scope, --ignore, or --since.
      `,
      type: "boolean"
    },
    "include-merged-tags": {
      describe: "Include tags from merged branches when running a command with --since.",
      type: "boolean"
    },
    "continue-if-no-match": {
      describe: "Don't fail if no package is matched",
      hidden: true,
      type: "boolean"
    }
  };
  return yargs2.options(opts).group(Object.keys(opts), "Filter Options:").option("include-filtered-dependents", {
    // TODO: remove in next major release
    hidden: true,
    conflicts: ["exclude-dependents", "include-dependents"],
    type: "boolean"
  }).option("include-filtered-dependencies", {
    // TODO: remove in next major release
    hidden: true,
    conflicts: "include-dependencies",
    type: "boolean"
  }).check((argv) => {
    if (argv["includeFilteredDependents"]) {
      argv["includeDependents"] = true;
      argv["include-dependents"] = true;
      delete argv["includeFilteredDependents"];
      delete argv["include-filtered-dependents"];
      import_npmlog16.default.warn("deprecated", "--include-filtered-dependents has been renamed --include-dependents");
    }
    if (argv["includeFilteredDependencies"]) {
      argv["includeDependencies"] = true;
      argv["include-dependencies"] = true;
      delete argv["includeFilteredDependencies"];
      delete argv["include-filtered-dependencies"];
      import_npmlog16.default.warn("deprecated", "--include-filtered-dependencies has been renamed --include-dependencies");
    }
    return argv;
  });
}
var import_dedent4, import_npmlog16;
var init_filter_options = __esm({
  "libs/core/src/lib/filter-options.ts"() {
    "use strict";
    import_dedent4 = __toESM(require("dedent"));
    import_npmlog16 = __toESM(require("npmlog"));
  }
});

// libs/core/src/lib/filter-projects.ts
function filterProjects(projectGraph, execOpts = {}, opts = {}) {
  const options = { log: import_npmlog17.default, ...opts };
  if (options.scope) {
    options.log.notice("filter", "including %j", options.scope);
  }
  if (options.ignore) {
    options.log.notice("filter", "excluding %j", options.ignore);
  }
  let projects = Object.values(projectGraph.nodes).filter((p) => !!p.package);
  const patterns = [].concat(arrify(options.scope), negate(arrify(options.ignore)));
  if (options.private === false) {
    projects = projects.filter((p) => !p.package?.private);
  }
  const patternsToLog = [...patterns];
  if (patterns.length) {
    if (!options.scope?.length) {
      patterns.unshift("**");
    }
    const packageNames = Array.from(projects).map((p) => p.package?.name).filter((p) => !!p);
    const chosen = new Set((0, import_multimatch.default)(packageNames, patterns));
    projects = projects.filter((p) => p.package?.name && chosen.has(p.package.name));
    if (!projects.length && !options.continueIfNoMatch) {
      throw new ValidationError("EFILTER", import_util.default.format("No packages remain after filtering", patterns));
    }
  }
  if (options.since !== void 0) {
    options.log.notice("filter", "changed since %j", options.since);
    if (options.excludeDependents) {
      options.log.notice("filter", "excluding dependents");
    }
    if (options.includeMergedTags) {
      options.log.notice("filter", "including merged tags");
    }
    const updates = collectProjectUpdates(projects, projectGraph, execOpts, opts);
    const updated = new Set(updates.map((node) => node.name));
    projects = projects.filter((project) => updated.has(project.name));
  }
  if (options.includeDependents) {
    options.log.notice("filter", "including dependents");
    projects = addDependents(projects, projectGraph);
  }
  if (options.includeDependencies) {
    options.log.notice("filter", "including dependencies");
    projects = addDependencies(projects, projectGraph);
  }
  if (patternsToLog.length) {
    import_npmlog17.default.info("filter", patternsToLog);
  }
  return projects;
}
function arrify(thing) {
  if (!thing) {
    return [];
  }
  if (!Array.isArray(thing)) {
    return [thing];
  }
  return thing;
}
function negate(patterns) {
  return patterns.map((pattern) => `!${pattern}`);
}
var import_multimatch, import_npmlog17, import_util;
var init_filter_projects = __esm({
  "libs/core/src/lib/filter-projects.ts"() {
    "use strict";
    import_multimatch = __toESM(require("multimatch"));
    import_npmlog17 = __toESM(require("npmlog"));
    import_util = __toESM(require("util"));
    init_add_dependencies();
    init_add_dependents();
    init_collect_project_updates();
    init_validation_error();
  }
});

// libs/core/src/lib/git-checkout.ts
var import_npmlog18, childProcess6;
var init_git_checkout = __esm({
  "libs/core/src/lib/git-checkout.ts"() {
    "use strict";
    import_npmlog18 = __toESM(require("npmlog"));
    childProcess6 = (init_src(), __toCommonJS(src_exports));
  }
});

// libs/core/src/lib/has-npm-version.ts
var import_semver4, childProcess7;
var init_has_npm_version = __esm({
  "libs/core/src/lib/has-npm-version.ts"() {
    "use strict";
    import_semver4 = __toESM(require("semver"));
    childProcess7 = (init_src(), __toCommonJS(src_exports));
  }
});

// libs/core/src/lib/cycles/get-cycles.ts
function getCycles(dependencies) {
  const cycles = [];
  const visited = /* @__PURE__ */ new Set();
  function dfs(next, path10) {
    visited.add(next);
    path10.push(next);
    for (const dep of dependencies[next] || []) {
      if (path10.includes(dep)) {
        const cycle = path10.slice(path10.indexOf(dep));
        cycles.push(cycle);
      } else if (!visited.has(dep)) {
        dfs(dep, path10);
      }
    }
    path10.pop();
  }
  for (const next of Object.keys(dependencies)) {
    if (!visited.has(next)) {
      dfs(next, []);
    }
  }
  return cycles;
}
var init_get_cycles = __esm({
  "libs/core/src/lib/cycles/get-cycles.ts"() {
    "use strict";
  }
});

// libs/core/src/lib/cycles/merge-overlapping-cycles.ts
function mergeOverlappingCycles(cycles) {
  const mergedCycles = [];
  cycles.forEach((cycle) => {
    let intersectionNodes = [];
    const mergedCycle = mergedCycles.find((mergedCycle2) => {
      intersectionNodes = (0, import_lodash4.intersection)(mergedCycle2, cycle);
      return intersectionNodes.length > 0;
    });
    if (mergedCycle) {
      mergedCycle.push(...(0, import_lodash4.difference)(cycle, intersectionNodes));
    } else {
      mergedCycles.push(cycle);
    }
  });
  return mergedCycles;
}
var import_lodash4;
var init_merge_overlapping_cycles = __esm({
  "libs/core/src/lib/cycles/merge-overlapping-cycles.ts"() {
    "use strict";
    import_lodash4 = require("lodash");
  }
});

// libs/core/src/lib/cycles/report-cycles.ts
function reportCycles(cycles, rejectCycles) {
  const cyclesWithRepeatedNodes = cycles.map((cycle) => [...cycle, cycle[0]]);
  const paths = Array.from(cyclesWithRepeatedNodes, (cycle) => cycle.join(" -> "), false);
  if (!paths.length) {
    return;
  }
  const cycleMessage = ["Dependency cycles detected, you should fix these!"].concat(paths).join("\n");
  if (rejectCycles) {
    throw new ValidationError("ECYCLE", cycleMessage);
  }
  import_npmlog19.default.warn("ECYCLE", cycleMessage);
}
var import_npmlog19;
var init_report_cycles = __esm({
  "libs/core/src/lib/cycles/report-cycles.ts"() {
    "use strict";
    import_npmlog19 = __toESM(require("npmlog"));
    init_validation_error();
  }
});

// libs/core/src/lib/cycles/index.ts
var init_cycles = __esm({
  "libs/core/src/lib/cycles/index.ts"() {
    "use strict";
    init_get_cycles();
    init_merge_overlapping_cycles();
    init_report_cycles();
  }
});

// libs/core/src/lib/toposort-projects.ts
var import_lodash5;
var init_toposort_projects = __esm({
  "libs/core/src/lib/toposort-projects.ts"() {
    "use strict";
    import_lodash5 = require("lodash");
    init_cycles();
  }
});

// libs/core/src/lib/listable-format-projects.ts
var import_chalk3, import_columnify;
var init_listable_format_projects = __esm({
  "libs/core/src/lib/listable-format-projects.ts"() {
    "use strict";
    import_chalk3 = __toESM(require("chalk"));
    import_columnify = __toESM(require("columnify"));
    init_project_graph_with_packages();
    init_toposort_projects();
  }
});

// libs/core/src/lib/listable-options.ts
var init_listable_options = __esm({
  "libs/core/src/lib/listable-options.ts"() {
    "use strict";
  }
});

// libs/core/src/lib/log-packed.ts
var import_byte_size, import_columnify2, import_npmlog20, import_has_unicode, hasUnicode;
var init_log_packed = __esm({
  "libs/core/src/lib/log-packed.ts"() {
    "use strict";
    import_byte_size = __toESM(require("byte-size"));
    import_columnify2 = __toESM(require("columnify"));
    import_npmlog20 = __toESM(require("npmlog"));
    import_has_unicode = __toESM(require("has-unicode"));
    hasUnicode = (0, import_has_unicode.default)();
  }
});

// libs/core/src/lib/npm-conf/env-replace.ts
function envReplace(str) {
  if (typeof str !== "string" || !str) {
    return str;
  }
  const regex = /(\\*)\$\{([^}]+)\}/g;
  return str.replace(regex, (orig, esc, name) => {
    esc = esc.length > 0 && esc.length % 2;
    if (esc) {
      return orig;
    }
    if (process.env[name] === void 0) {
      throw new Error(`Failed to replace env in config: ${orig}`);
    }
    return process.env[name];
  });
}
var init_env_replace = __esm({
  "libs/core/src/lib/npm-conf/env-replace.ts"() {
    "use strict";
  }
});

// libs/core/src/lib/npm-conf/find-prefix.ts
function findPrefix(start) {
  let dir = import_path9.default.resolve(start);
  let walkedUp = false;
  while (import_path9.default.basename(dir) === "node_modules") {
    dir = import_path9.default.dirname(dir);
    walkedUp = true;
  }
  if (walkedUp) {
    return dir;
  }
  return find(dir, dir);
}
function find(name, original) {
  if (name === "/" || process.platform === "win32" && /^[a-zA-Z]:(\\|\/)?$/.test(name)) {
    return original;
  }
  try {
    const files = import_fs3.default.readdirSync(name);
    if (files.indexOf("node_modules") !== -1 || files.indexOf("package.json") !== -1) {
      return name;
    }
    const dirname = import_path9.default.dirname(name);
    if (dirname === name) {
      return original;
    }
    return find(dirname, original);
  } catch (err) {
    if (name === original) {
      if (err.code === "ENOENT") {
        return original;
      }
      throw err;
    }
    return original;
  }
}
var import_fs3, import_path9;
var init_find_prefix = __esm({
  "libs/core/src/lib/npm-conf/find-prefix.ts"() {
    "use strict";
    import_fs3 = __toESM(require("fs"));
    import_path9 = __toESM(require("path"));
  }
});

// libs/core/src/lib/npm-conf/types.ts
var require_types = __commonJS({
  "libs/core/src/lib/npm-conf/types.ts"(exports2) {
    "use strict";
    var import_path13 = __toESM(require("path"));
    var import_stream = require("stream");
    var import_url2 = __toESM(require("url"));
    var Umask = () => {
    };
    var getLocalAddresses = () => [];
    var semver4 = () => {
    };
    exports2.types = {
      access: [null, "restricted", "public"],
      "allow-same-version": Boolean,
      "always-auth": Boolean,
      also: [null, "dev", "development"],
      audit: Boolean,
      "audit-level": ["low", "moderate", "high", "critical"],
      "auth-type": ["legacy", "sso", "saml", "oauth"],
      "bin-links": Boolean,
      browser: [null, String],
      ca: [null, String, Array],
      cafile: import_path13.default,
      cache: import_path13.default,
      "cache-lock-stale": Number,
      "cache-lock-retries": Number,
      "cache-lock-wait": Number,
      "cache-max": Number,
      "cache-min": Number,
      cert: [null, String],
      cidr: [null, String, Array],
      color: ["always", Boolean],
      depth: Number,
      description: Boolean,
      dev: Boolean,
      "dry-run": Boolean,
      editor: String,
      "engine-strict": Boolean,
      force: Boolean,
      "fetch-retries": Number,
      "fetch-retry-factor": Number,
      "fetch-retry-mintimeout": Number,
      "fetch-retry-maxtimeout": Number,
      git: String,
      "git-tag-version": Boolean,
      "commit-hooks": Boolean,
      global: Boolean,
      globalconfig: import_path13.default,
      "global-style": Boolean,
      group: [Number, String],
      "https-proxy": [null, import_url2.default],
      "user-agent": String,
      "ham-it-up": Boolean,
      heading: String,
      "if-present": Boolean,
      "ignore-prepublish": Boolean,
      "ignore-scripts": Boolean,
      "init-module": import_path13.default,
      "init-author-name": String,
      "init-author-email": String,
      "init-author-url": ["", import_url2.default],
      "init-license": String,
      "init-version": semver4,
      json: Boolean,
      key: [null, String],
      "legacy-bundling": Boolean,
      link: Boolean,
      "local-address": getLocalAddresses(),
      loglevel: ["silent", "error", "warn", "notice", "http", "timing", "info", "verbose", "silly"],
      logstream: import_stream.Stream,
      "logs-max": Number,
      long: Boolean,
      maxsockets: Number,
      message: String,
      "metrics-registry": [null, String],
      "node-options": [null, String],
      "node-version": [null, semver4],
      noproxy: [null, String, Array],
      offline: Boolean,
      "onload-script": [null, String],
      only: [null, "dev", "development", "prod", "production"],
      optional: Boolean,
      "package-lock": Boolean,
      otp: [null, String],
      "package-lock-only": Boolean,
      parseable: Boolean,
      "prefer-offline": Boolean,
      "prefer-online": Boolean,
      prefix: import_path13.default,
      preid: String,
      production: Boolean,
      progress: Boolean,
      // allow proxy to be disabled explicitly
      proxy: [null, false, import_url2.default],
      "read-only": Boolean,
      "rebuild-bundle": Boolean,
      registry: [null, import_url2.default],
      rollback: Boolean,
      save: Boolean,
      "save-bundle": Boolean,
      "save-dev": Boolean,
      "save-exact": Boolean,
      "save-optional": Boolean,
      "save-prefix": String,
      "save-prod": Boolean,
      scope: String,
      "script-shell": [null, String],
      "scripts-prepend-node-path": [false, true, "auto", "warn-only"],
      searchopts: String,
      searchexclude: [null, String],
      searchlimit: Number,
      searchstaleness: Number,
      "send-metrics": Boolean,
      shell: String,
      shrinkwrap: Boolean,
      "sign-git-commit": Boolean,
      "sign-git-tag": Boolean,
      "sso-poll-frequency": Number,
      "sso-type": [null, "oauth", "saml"],
      "strict-ssl": Boolean,
      tag: String,
      timing: Boolean,
      tmp: import_path13.default,
      unicode: Boolean,
      "unsafe-perm": Boolean,
      "update-notifier": Boolean,
      usage: Boolean,
      user: [Number, String],
      userconfig: import_path13.default,
      umask: Umask,
      version: Boolean,
      "tag-version-prefix": String,
      versions: Boolean,
      viewer: String,
      _exit: Boolean
    };
  }
});

// libs/core/src/lib/npm-conf/parse-field.ts
function parseField(input, key) {
  if (typeof input !== "string") {
    return input;
  }
  const typeList = [].concat(types[key]);
  const isPath = typeList.indexOf(import_path10.default) !== -1;
  const isBool = typeList.indexOf(Boolean) !== -1;
  const isString = typeList.indexOf(String) !== -1;
  const isNumber = typeList.indexOf(Number) !== -1;
  let field = `${input}`.trim();
  if (/^".*"$/.test(field)) {
    try {
      field = JSON.parse(field);
    } catch (err) {
      throw new Error(`Failed parsing JSON config key ${key}: ${field}`);
    }
  }
  if (isBool && !isString && field === "") {
    return true;
  }
  switch (field) {
    case "true": {
      return true;
    }
    case "false": {
      return false;
    }
    case "null": {
      return null;
    }
    case "undefined": {
      return void 0;
    }
  }
  field = envReplace(field);
  if (isPath) {
    const regex = process.platform === "win32" ? /^~(\/|\\)/ : /^~\//;
    if (regex.test(field) && process.env["HOME"]) {
      field = import_path10.default.resolve(process.env["HOME"], field.substr(2));
    }
    field = import_path10.default.resolve(field);
  }
  if (isNumber && !Number.isNaN(field)) {
    field = Number(field);
  }
  return field;
}
var import_path10, types;
var init_parse_field = __esm({
  "libs/core/src/lib/npm-conf/parse-field.ts"() {
    "use strict";
    import_path10 = __toESM(require("path"));
    init_env_replace();
    ({ types } = require_types());
  }
});

// libs/core/src/lib/npm-conf/nerf-dart.ts
function toNerfDart(uri) {
  const parsed = import_url.default.parse(uri);
  delete parsed.protocol;
  delete parsed.auth;
  delete parsed.query;
  delete parsed.search;
  delete parsed.hash;
  return import_url.default.resolve(import_url.default.format(parsed), ".");
}
var import_url;
var init_nerf_dart = __esm({
  "libs/core/src/lib/npm-conf/nerf-dart.ts"() {
    "use strict";
    import_url = __toESM(require("url"));
  }
});

// libs/core/src/lib/npm-conf/config-chain/proto-list.ts
var require_proto_list = __commonJS({
  "libs/core/src/lib/npm-conf/config-chain/proto-list.ts"(exports2, module2) {
    "use strict";
    module2.exports = ProtoList;
    function setProto(obj, proto) {
      if (typeof Object.setPrototypeOf === "function")
        return Object.setPrototypeOf(obj, proto);
      else
        obj.__proto__ = proto;
    }
    function ProtoList() {
      this.list = [];
      var root = null;
      Object.defineProperty(this, "root", {
        get: function() {
          return root;
        },
        set: function(r) {
          root = r;
          if (this.list.length) {
            setProto(this.list[this.list.length - 1], r);
          }
        },
        enumerable: true,
        configurable: true
      });
    }
    ProtoList.prototype = {
      get length() {
        return this.list.length;
      },
      get keys() {
        var k = [];
        for (var i in this.list[0])
          k.push(i);
        return k;
      },
      get snapshot() {
        var o2 = {};
        this.keys.forEach(function(k) {
          o2[k] = this.get(k);
        }, this);
        return o2;
      },
      get store() {
        return this.list[0];
      },
      push: function(obj) {
        if (typeof obj !== "object")
          obj = { valueOf: obj };
        if (this.list.length >= 1) {
          setProto(this.list[this.list.length - 1], obj);
        }
        setProto(obj, this.root);
        return this.list.push(obj);
      },
      pop: function() {
        if (this.list.length >= 2) {
          setProto(this.list[this.list.length - 2], this.root);
        }
        return this.list.pop();
      },
      unshift: function(obj) {
        setProto(obj, this.list[0] || this.root);
        return this.list.unshift(obj);
      },
      shift: function() {
        if (this.list.length === 1) {
          setProto(this.list[0], this.root);
        }
        return this.list.shift();
      },
      get: function(key) {
        return this.list[0][key];
      },
      set: function(key, val, save) {
        if (!this.length)
          this.push({});
        if (save && this.list[0].hasOwnProperty(key))
          this.push({});
        return this.list[0][key] = val;
      },
      forEach: function(fn, thisp) {
        for (var key in this.list[0])
          fn.call(thisp, key, this.list[0][key]);
      },
      slice: function() {
        return this.list.slice.apply(this.list, arguments);
      },
      splice: function() {
        var ret = this.list.splice.apply(this.list, arguments);
        for (var i = 0, l = this.list.length; i < l; i++) {
          setProto(this.list[i], this.list[i + 1] || this.root);
        }
        return ret;
      }
    };
  }
});

// libs/core/src/lib/npm-conf/config-chain/index.ts
var require_config_chain = __commonJS({
  "libs/core/src/lib/npm-conf/config-chain/index.ts"(exports2, module2) {
    "use strict";
    var ProtoList = require_proto_list();
    var path10 = require("path");
    var fs12 = require("fs");
    var ini = require("ini");
    var EE = require("events").EventEmitter;
    var url2 = require("url");
    var http = require("http");
    var exports2 = module2.exports = function() {
      var args = [].slice.call(arguments), conf = new ConfigChain2();
      while (args.length) {
        var a = args.shift();
        if (a)
          conf.push("string" === typeof a ? json(a) : a);
      }
      return conf;
    };
    var find2 = exports2.find = function() {
      var rel = path10.join.apply(null, [].slice.call(arguments));
      function find3(start, rel2) {
        var file = path10.join(start, rel2);
        try {
          fs12.statSync(file);
          return file;
        } catch (err) {
          if (path10.dirname(start) !== start)
            return find3(path10.dirname(start), rel2);
        }
      }
      return find3(__dirname, rel);
    };
    var parse2 = exports2.parse = function(content, file, type) {
      content = "" + content;
      if (!type) {
        try {
          return JSON.parse(content);
        } catch (er) {
          return ini.parse(content);
        }
      } else if (type === "json") {
        if (this.emit) {
          try {
            return JSON.parse(content);
          } catch (er) {
            this.emit("error", er);
          }
        } else {
          return JSON.parse(content);
        }
      } else {
        return ini.parse(content);
      }
    };
    var json = exports2.json = function() {
      var args = [].slice.call(arguments).filter(function(arg) {
        return arg != null;
      });
      var file = path10.join.apply(null, args);
      var content;
      try {
        content = fs12.readFileSync(file, "utf-8");
      } catch (err) {
        return;
      }
      return parse2(content, file, "json");
    };
    var env = exports2.env = function(prefix, env2) {
      env2 = env2 || process.env;
      var obj = {};
      var l = prefix.length;
      for (var k in env2) {
        if (k.indexOf(prefix) === 0)
          obj[k.substring(l)] = env2[k];
      }
      return obj;
    };
    exports2.ConfigChain = ConfigChain2;
    function ConfigChain2() {
      EE.apply(this);
      ProtoList.apply(this, arguments);
      this._awaiting = 0;
      this._saving = 0;
      this.sources = {};
    }
    var extras = {
      constructor: { value: ConfigChain2 }
    };
    Object.keys(EE.prototype).forEach(function(k) {
      extras[k] = Object.getOwnPropertyDescriptor(EE.prototype, k);
    });
    ConfigChain2.prototype = Object.create(ProtoList.prototype, extras);
    ConfigChain2.prototype.del = function(key, where) {
      if (where) {
        var target = this.sources[where];
        target = target && target.data;
        if (!target) {
          return this.emit("error", new Error("not found " + where));
        }
        delete target[key];
      } else {
        for (var i = 0, l = this.list.length; i < l; i++) {
          delete this.list[i][key];
        }
      }
      return this;
    };
    ConfigChain2.prototype.set = function(key, value, where) {
      var target;
      if (where) {
        target = this.sources[where];
        target = target && target.data;
        if (!target) {
          return this.emit("error", new Error("not found " + where));
        }
      } else {
        target = this.list[0];
        if (!target) {
          return this.emit("error", new Error("cannot set, no confs!"));
        }
      }
      target[key] = value;
      return this;
    };
    ConfigChain2.prototype.get = function(key, where) {
      if (where) {
        where = this.sources[where];
        if (where)
          where = where.data;
        if (where && Object.hasOwnProperty.call(where, key))
          return where[key];
        return void 0;
      }
      return this.list[0][key];
    };
    ConfigChain2.prototype.save = function(where, type, cb) {
      if (typeof type === "function")
        cb = type, type = null;
      var target = this.sources[where];
      if (!target || !(target.path || target.source) || !target.data) {
        return this.emit("error", new Error("bad save target: " + where));
      }
      if (target.source) {
        var pref = target.prefix || "";
        Object.keys(target.data).forEach(function(k) {
          target.source[pref + k] = target.data[k];
        });
        return this;
      }
      var type = type || target.type;
      var data = target.data;
      if (target.type === "json") {
        data = JSON.stringify(data);
      } else {
        data = ini.stringify(data);
      }
      this._saving++;
      fs12.writeFile(
        target.path,
        data,
        "utf8",
        function(er) {
          this._saving--;
          if (er) {
            if (cb)
              return cb(er);
            else
              return this.emit("error", er);
          }
          if (this._saving === 0) {
            if (cb)
              cb();
            this.emit("save");
          }
        }.bind(this)
      );
      return this;
    };
    ConfigChain2.prototype.addFile = function(file, type, name) {
      name = name || file;
      var marker = { __source__: name };
      this.sources[name] = { path: file, type };
      this.push(marker);
      this._await();
      fs12.readFile(
        file,
        "utf8",
        function(er, data) {
          if (er)
            this.emit("error", er);
          this.addString(data, file, type, marker);
        }.bind(this)
      );
      return this;
    };
    ConfigChain2.prototype.addEnv = function(prefix, env2, name) {
      name = name || "env";
      var data = exports2.env(prefix, env2);
      this.sources[name] = { data, source: env2, prefix };
      return this.add(data, name);
    };
    ConfigChain2.prototype.addUrl = function(req, type, name) {
      this._await();
      var href = url2.format(req);
      name = name || href;
      var marker = { __source__: name };
      this.sources[name] = { href, type };
      this.push(marker);
      http.request(
        req,
        function(res) {
          var c = [];
          var ct = res.headers["content-type"];
          if (!type) {
            type = ct.indexOf("json") !== -1 ? "json" : ct.indexOf("ini") !== -1 ? "ini" : href.match(/\.json$/) ? "json" : href.match(/\.ini$/) ? "ini" : null;
            marker.type = type;
          }
          res.on("data", c.push.bind(c)).on(
            "end",
            function() {
              this.addString(Buffer.concat(c), href, type, marker);
            }.bind(this)
          ).on("error", this.emit.bind(this, "error"));
        }.bind(this)
      ).on("error", this.emit.bind(this, "error")).end();
      return this;
    };
    ConfigChain2.prototype.addString = function(data, file, type, marker) {
      data = this.parse(data, file, type);
      this.add(data, marker);
      return this;
    };
    ConfigChain2.prototype.add = function(data, marker) {
      if (marker && typeof marker === "object") {
        var i = this.list.indexOf(marker);
        if (i === -1) {
          return this.emit("error", new Error("bad marker"));
        }
        this.splice(i, 1, data);
        marker = marker.__source__;
        this.sources[marker] = this.sources[marker] || {};
        this.sources[marker].data = data;
        this._resolve();
      } else {
        if (typeof marker === "string") {
          this.sources[marker] = this.sources[marker] || {};
          this.sources[marker].data = data;
        }
        this._await();
        this.push(data);
        process.nextTick(this._resolve.bind(this));
      }
      return this;
    };
    ConfigChain2.prototype.parse = exports2.parse;
    ConfigChain2.prototype._await = function() {
      this._awaiting++;
    };
    ConfigChain2.prototype._resolve = function() {
      this._awaiting--;
      if (this._awaiting === 0)
        this.emit("load", this);
    };
  }
});

// libs/core/src/lib/npm-conf/conf.ts
var import_assert, import_fs4, import_path11, ConfigChain, Conf;
var init_conf = __esm({
  "libs/core/src/lib/npm-conf/conf.ts"() {
    "use strict";
    import_assert = __toESM(require("assert"));
    import_fs4 = __toESM(require("fs"));
    import_path11 = __toESM(require("path"));
    init_env_replace();
    init_find_prefix();
    init_parse_field();
    init_nerf_dart();
    ({ ConfigChain } = require_config_chain());
    Conf = class extends ConfigChain {
      // https://github.com/npm/npm/blob/latest/lib/config/core.js#L208-L222
      constructor(base) {
        super(base);
        this.root = base;
      }
      // https://github.com/npm/npm/blob/latest/lib/config/core.js#L332-L342
      add(data, marker) {
        try {
          for (const x of Object.keys(data)) {
            const newKey = envReplace(x);
            const newField = parseField(data[x], newKey);
            delete data[x];
            data[newKey] = newField;
          }
        } catch (err) {
          throw err;
        }
        return super.add(data, marker);
      }
      // https://github.com/npm/npm/blob/latest/lib/config/core.js#L312-L325
      addFile(file, name = file) {
        const marker = { __source__: name };
        this["sources"][name] = { path: file, type: "ini" };
        this["push"](marker);
        this["_await"]();
        try {
          const contents = import_fs4.default.readFileSync(file, "utf8");
          this["addString"](contents, file, "ini", marker);
        } catch (err) {
          this["add"]({}, marker);
        }
        return this;
      }
      // https://github.com/npm/npm/blob/latest/lib/config/core.js#L344-L360
      addEnv(env = process.env) {
        const conf = {};
        Object.keys(env).filter((x) => /^npm_config_/i.test(x)).forEach((x) => {
          if (!env[x]) {
            return;
          }
          const p = x.toLowerCase().replace(/^npm_config_/, "").replace(/(?!^)_/g, "-");
          conf[p] = env[x];
        });
        return super.addEnv("", conf, "env");
      }
      // https://github.com/npm/npm/blob/latest/lib/config/load-prefix.js
      loadPrefix() {
        const cli = this["list"][0];
        Object.defineProperty(this, "prefix", {
          enumerable: true,
          set: (prefix) => {
            const g = this["get"]("global");
            this[g ? "globalPrefix" : "localPrefix"] = prefix;
          },
          get: () => {
            const g = this["get"]("global");
            return g ? this["globalPrefix"] : this["localPrefix"];
          }
        });
        Object.defineProperty(this, "globalPrefix", {
          enumerable: true,
          set: (prefix) => {
            this["set"]("prefix", prefix);
          },
          get: () => import_path11.default.resolve(this["get"]("prefix"))
        });
        let p;
        Object.defineProperty(this, "localPrefix", {
          enumerable: true,
          set: (prefix) => {
            p = prefix;
          },
          get: () => p
        });
        if (Object.prototype.hasOwnProperty.call(cli, "prefix")) {
          p = import_path11.default.resolve(cli.prefix);
        } else {
          try {
            p = findPrefix(process.cwd());
          } catch (err) {
            throw err;
          }
        }
        return p;
      }
      // https://github.com/npm/npm/blob/latest/lib/config/load-cafile.js
      loadCAFile(file) {
        if (!file) {
          return;
        }
        try {
          const contents = import_fs4.default.readFileSync(file, "utf8");
          const delim = "-----END CERTIFICATE-----";
          const output2 = contents.split(delim).filter((x) => Boolean(x.trim())).map((x) => x.trimLeft() + delim);
          this["set"]("ca", output2);
        } catch (err) {
          if (err.code === "ENOENT") {
            return;
          }
          throw err;
        }
      }
      // https://github.com/npm/npm/blob/latest/lib/config/set-user.js
      loadUser() {
        const defConf = this.root;
        if (this["get"]("global")) {
          return;
        }
        if (process.env["SUDO_UID"]) {
          defConf.user = Number(process.env["SUDO_UID"]);
          return;
        }
        const prefix = import_path11.default.resolve(this["get"]("prefix"));
        try {
          const stats = import_fs4.default.statSync(prefix);
          defConf.user = stats.uid;
        } catch (err) {
          if (err.code === "ENOENT") {
            return;
          }
          throw err;
        }
      }
      // https://github.com/npm/npm/blob/24ec9f2/lib/config/get-credentials-by-uri.js
      getCredentialsByURI(uri) {
        (0, import_assert.default)(uri && typeof uri === "string", "registry URL is required");
        const nerfed = toNerfDart(uri);
        const defnerf = toNerfDart(this["get"]("registry"));
        const c = {
          scope: nerfed,
          token: void 0,
          password: void 0,
          username: void 0,
          email: void 0,
          auth: void 0,
          alwaysAuth: void 0
        };
        if (this["get"](`${nerfed}:always-auth`) !== void 0) {
          const val = this["get"](`${nerfed}:always-auth`);
          c.alwaysAuth = val === "false" ? false : !!val;
        } else if (this["get"]("always-auth") !== void 0) {
          c.alwaysAuth = this["get"]("always-auth");
        }
        if (this["get"](`${nerfed}:_authToken`)) {
          c.token = this["get"](`${nerfed}:_authToken`);
          return c;
        }
        let authDef = this["get"]("_auth");
        let userDef = this["get"]("username");
        let passDef = this["get"]("_password");
        if (authDef && !(userDef && passDef)) {
          authDef = Buffer.from(authDef, "base64").toString();
          authDef = authDef.split(":");
          userDef = authDef.shift();
          passDef = authDef.join(":");
        }
        if (this["get"](`${nerfed}:_password`)) {
          c.password = Buffer.from(this["get"](`${nerfed}:_password`), "base64").toString("utf8");
        } else if (nerfed === defnerf && passDef) {
          c.password = passDef;
        }
        if (this["get"](`${nerfed}:username`)) {
          c.username = this["get"](`${nerfed}:username`);
        } else if (nerfed === defnerf && userDef) {
          c.username = userDef;
        }
        if (this["get"](`${nerfed}:email`)) {
          c.email = this["get"](`${nerfed}:email`);
        } else if (this["get"]("email")) {
          c.email = this["get"]("email");
        }
        if (c.username && c.password) {
          c.auth = Buffer.from(`${c.username}:${c.password}`).toString("base64");
        }
        return c;
      }
      // https://github.com/npm/npm/blob/24ec9f2/lib/config/set-credentials-by-uri.js
      setCredentialsByURI(uri, c) {
        (0, import_assert.default)(uri && typeof uri === "string", "registry URL is required");
        (0, import_assert.default)(c && typeof c === "object", "credentials are required");
        const nerfed = toNerfDart(uri);
        if (c.token) {
          this["set"](`${nerfed}:_authToken`, c.token, "user");
          this["del"](`${nerfed}:_password`, "user");
          this["del"](`${nerfed}:username`, "user");
          this["del"](`${nerfed}:email`, "user");
          this["del"](`${nerfed}:always-auth`, "user");
        } else if (c.username || c.password || c.email) {
          (0, import_assert.default)(c.username, "must include username");
          (0, import_assert.default)(c.password, "must include password");
          (0, import_assert.default)(c.email, "must include email address");
          this["del"](`${nerfed}:_authToken`, "user");
          const encoded = Buffer.from(c.password, "utf8").toString("base64");
          this["set"](`${nerfed}:_password`, encoded, "user");
          this["set"](`${nerfed}:username`, c.username, "user");
          this["set"](`${nerfed}:email`, c.email, "user");
          if (c.alwaysAuth !== void 0) {
            this["set"](`${nerfed}:always-auth`, c.alwaysAuth, "user");
          } else {
            this["del"](`${nerfed}:always-auth`, "user");
          }
        } else {
          throw new Error("No credentials to set.");
        }
      }
    };
  }
});

// libs/core/src/lib/get-npm-exec-opts.ts
function getNpmExecOpts(pkg, registry) {
  const env = {
    LERNA_PACKAGE_NAME: pkg.name
  };
  if (registry) {
    env.npm_config_registry = registry;
  }
  import_npmlog21.default.silly("getNpmExecOpts", pkg.location, registry);
  return {
    cwd: pkg.location,
    env,
    pkg
  };
}
var import_npmlog21;
var init_get_npm_exec_opts = __esm({
  "libs/core/src/lib/get-npm-exec-opts.ts"() {
    "use strict";
    import_npmlog21 = __toESM(require("npmlog"));
  }
});

// libs/core/src/lib/npm-install.ts
function npmInstall(pkg, { registry, npmClient, npmClientArgs, npmGlobalStyle, mutex, stdio = "pipe", subCommand = "install" }) {
  const opts = getNpmExecOpts(pkg, registry);
  const args = [subCommand];
  let cmd2 = npmClient || "npm";
  if (npmGlobalStyle) {
    cmd2 = "npm";
    args.push("--global-style");
  }
  if (cmd2 === "yarn" && mutex) {
    args.push("--mutex", mutex);
  }
  if (cmd2 === "yarn") {
    args.push("--non-interactive");
  }
  if (npmClientArgs && npmClientArgs.length) {
    args.push(...npmClientArgs);
  }
  opts.stdio = stdio;
  opts.env.LERNA_EXEC_PATH = pkg.location;
  opts.env.LERNA_ROOT_PATH = pkg.rootPath;
  import_npmlog22.default.silly("npmInstall", [cmd2, args]);
  return childProcess8.exec(cmd2, args, opts);
}
function npmInstallDependencies(pkg, dependencies, config) {
  import_npmlog22.default.silly("npmInstallDependencies", pkg.name, dependencies);
  if (!(dependencies && dependencies.length)) {
    import_npmlog22.default.verbose("npmInstallDependencies", "no dependencies to install");
    return Promise.resolve();
  }
  const packageJsonBkp = `${pkg.manifestLocation}.lerna_backup`;
  import_npmlog22.default.silly("npmInstallDependencies", "backup", pkg.manifestLocation);
  return import_fs_extra4.default.copy(pkg.manifestLocation, packageJsonBkp).then(() => {
    const cleanup = () => {
      import_npmlog22.default.silly("npmInstallDependencies", "cleanup", pkg.manifestLocation);
      import_fs_extra4.default.renameSync(packageJsonBkp, pkg.manifestLocation);
    };
    const unregister = (0, import_signal_exit.default)(cleanup);
    const done = (finalError) => {
      cleanup();
      unregister();
      if (finalError) {
        throw finalError;
      }
    };
    const tempJson = transformManifest(pkg, dependencies);
    import_npmlog22.default.silly("npmInstallDependencies", "writing tempJson", tempJson);
    return (0, import_write_pkg2.default)(pkg.manifestLocation, tempJson).then(() => npmInstall(pkg, config)).then(() => done(), done);
  });
}
function transformManifest(pkg, dependencies) {
  const json = pkg.toJSON();
  const depMap = new Map(
    dependencies.map((dep) => {
      const { name, rawSpec } = (0, import_npm_package_arg4.default)(dep, pkg.location);
      return [name, rawSpec || "*"];
    })
  );
  delete json.scripts;
  ["dependencies", "devDependencies", "optionalDependencies"].forEach((depType) => {
    const collection = json[depType];
    if (collection) {
      Object.keys(collection).forEach((depName) => {
        if (depMap.has(depName)) {
          collection[depName] = depMap.get(depName);
          depMap.delete(depName);
        } else {
          delete collection[depName];
        }
      });
    }
  });
  ["bundledDependencies", "bundleDependencies"].forEach((depType) => {
    const collection = json[depType];
    if (Array.isArray(collection)) {
      const newCollection = [];
      for (const depName of collection) {
        if (depMap.has(depName)) {
          newCollection.push(depName);
          depMap.delete(depName);
        }
      }
      json[depType] = newCollection;
    }
  });
  if (depMap.size) {
    if (!json.dependencies) {
      json.dependencies = {};
    }
    depMap.forEach((depVersion, depName) => {
      json.dependencies[depName] = depVersion;
    });
  }
  return json;
}
var import_fs_extra4, import_npm_package_arg4, import_npmlog22, import_signal_exit, import_write_pkg2, childProcess8;
var init_npm_install = __esm({
  "libs/core/src/lib/npm-install.ts"() {
    "use strict";
    import_fs_extra4 = __toESM(require("fs-extra"));
    import_npm_package_arg4 = __toESM(require("npm-package-arg"));
    import_npmlog22 = __toESM(require("npmlog"));
    import_signal_exit = __toESM(require("signal-exit"));
    import_write_pkg2 = __toESM(require("write-pkg"));
    init_get_npm_exec_opts();
    childProcess8 = (init_src(), __toCommonJS(src_exports));
    module.exports.npmInstallDependencies = npmInstallDependencies;
  }
});

// libs/core/src/lib/prompt.ts
function promptTextInput(message, { filter, validate } = {}) {
  import_npmlog23.default.pause();
  return import_inquirer.default.prompt([
    {
      type: "input",
      name: "input",
      message,
      filter,
      validate
    }
  ]).then((answers) => {
    import_npmlog23.default.resume();
    return answers["input"];
  });
}
var import_inquirer, import_npmlog23;
var init_prompt = __esm({
  "libs/core/src/lib/prompt.ts"() {
    "use strict";
    import_inquirer = __toESM(require("inquirer"));
    import_npmlog23 = __toESM(require("npmlog"));
  }
});

// libs/core/src/lib/otplease.ts
function otplease(fn, _opts, otpCache) {
  const opts = { ...otpCache, ..._opts };
  return attempt(fn, opts, otpCache);
}
function attempt(fn, opts, otpCache) {
  return new Promise((resolve3) => {
    resolve3(fn(opts));
  }).catch((err) => {
    if (err.code !== "EOTP" && !(err.code === "E401" && /one-time pass/.test(err.body))) {
      throw err;
    } else if (!process.stdin.isTTY || !process.stdout.isTTY) {
      throw err;
    } else {
      if (otpCache != null && otpCache.otp != null && otpCache.otp !== opts["otp"]) {
        return attempt(fn, { ...opts, ...otpCache }, otpCache);
      }
      return semaphore.wait().then(() => {
        if (otpCache != null && otpCache.otp != null && otpCache.otp !== opts["otp"]) {
          semaphore.release();
          return attempt(fn, { ...opts, ...otpCache }, otpCache);
        }
        return getOneTimePassword().then(
          (otp) => {
            if (otpCache != null) {
              otpCache.otp = otp;
            }
            semaphore.release();
            return otp;
          },
          (promptError) => {
            semaphore.release();
            return Promise.reject(promptError);
          }
        ).then((otp) => {
          return fn({ ...opts, otp });
        });
      });
    }
  });
}
function getOneTimePassword(message = "This operation requires a one-time password:") {
  return promptTextInput(message, {
    filter: (otp) => otp.replace(/\s+/g, ""),
    validate: (otp) => otp && /^[\d ]+$|^[A-Fa-f0-9]{64,64}$/.test(otp) || "Must be a valid one-time-password. See https://docs.npmjs.com/getting-started/using-two-factor-authentication"
  });
}
var semaphore;
var init_otplease = __esm({
  "libs/core/src/lib/otplease.ts"() {
    "use strict";
    init_prompt();
    semaphore = {
      _promise: void 0,
      _resolve: void 0,
      wait() {
        return new Promise((resolve3) => {
          if (!this._promise) {
            this._promise = new Promise((release) => {
              this._resolve = release;
            });
            resolve3(void 0);
          } else {
            resolve3(this._promise.then(() => this.wait()));
          }
        });
      },
      release() {
        const resolve3 = this._resolve;
        if (resolve3) {
          this._resolve = void 0;
          this._promise = void 0;
          resolve3();
        }
      }
    };
  }
});

// libs/core/src/lib/npm-conf/defaults.ts
var require_defaults = __commonJS({
  "libs/core/src/lib/npm-conf/defaults.ts"(exports2) {
    "use strict";
    var import_os4 = __toESM(require("os"));
    var import_path13 = __toESM(require("path"));
    var temp = import_os4.default.tmpdir();
    var uidOrPid = process.getuid ? process.getuid() : process.pid;
    var hasUnicode2 = () => true;
    var isWindows = process.platform === "win32";
    var osenv = {
      editor: () => process.env["EDITOR"] || process.env["VISUAL"] || (isWindows ? "notepad.exe" : "vi"),
      shell: () => isWindows ? process.env["COMSPEC"] || "cmd.exe" : process.env["SHELL"] || "/bin/bash"
    };
    var umask = {
      fromString: () => process.umask()
    };
    var home = import_os4.default.homedir();
    if (home) {
      process.env["HOME"] = home;
    } else {
      home = import_path13.default.resolve(temp, `npm-${uidOrPid}`);
    }
    var cacheExtra = process.platform === "win32" ? "npm-cache" : ".npm";
    var cacheRoot = process.platform === "win32" && process.env["APPDATA"] || home;
    var cache = import_path13.default.resolve(cacheRoot, cacheExtra);
    var defaults;
    var globalPrefix;
    Object.defineProperty(exports2, "defaults", {
      get() {
        if (defaults) {
          return defaults;
        }
        if (process.env["PREFIX"]) {
          globalPrefix = process.env["PREFIX"];
        } else if (process.platform === "win32") {
          globalPrefix = import_path13.default.dirname(process.execPath);
        } else {
          globalPrefix = import_path13.default.dirname(import_path13.default.dirname(process.execPath));
          if (process.env["DESTDIR"]) {
            globalPrefix = import_path13.default.join(process.env["DESTDIR"], globalPrefix);
          }
        }
        defaults = {
          access: null,
          "allow-same-version": false,
          "always-auth": false,
          also: null,
          audit: true,
          "audit-level": "low",
          "auth-type": "legacy",
          "bin-links": true,
          browser: null,
          ca: null,
          cafile: null,
          cache,
          "cache-lock-stale": 6e4,
          "cache-lock-retries": 10,
          "cache-lock-wait": 1e4,
          "cache-max": Infinity,
          "cache-min": 10,
          cert: null,
          cidr: null,
          color: process.env["NO_COLOR"] == null,
          depth: Infinity,
          description: true,
          dev: false,
          "dry-run": false,
          editor: osenv.editor(),
          "engine-strict": false,
          force: false,
          "fetch-retries": 2,
          "fetch-retry-factor": 10,
          "fetch-retry-mintimeout": 1e4,
          "fetch-retry-maxtimeout": 6e4,
          git: "git",
          "git-tag-version": true,
          "commit-hooks": true,
          global: false,
          globalconfig: import_path13.default.resolve(globalPrefix, "etc", "npmrc"),
          "global-style": false,
          group: process.platform === "win32" ? 0 : process.env["SUDO_GID"] || process.getgid && process.getgid(),
          "ham-it-up": false,
          heading: "npm",
          "if-present": false,
          "ignore-prepublish": false,
          "ignore-scripts": false,
          "init-module": import_path13.default.resolve(home, ".npm-init.js"),
          "init-author-name": "",
          "init-author-email": "",
          "init-author-url": "",
          "init-version": "1.0.0",
          "init-license": "ISC",
          json: false,
          key: null,
          "legacy-bundling": false,
          link: false,
          "local-address": void 0,
          loglevel: "notice",
          logstream: process.stderr,
          "logs-max": 10,
          long: false,
          maxsockets: 50,
          message: "%s",
          "metrics-registry": null,
          "node-options": null,
          "node-version": process.version,
          offline: false,
          "onload-script": false,
          only: null,
          optional: true,
          otp: void 0,
          "package-lock": true,
          "package-lock-only": false,
          parseable: false,
          "prefer-offline": false,
          "prefer-online": false,
          prefix: globalPrefix,
          preid: "",
          production: process.env["NODE_ENV"] === "production",
          progress: !process.env["TRAVIS"] && !process.env["CI"],
          proxy: null,
          "https-proxy": null,
          noproxy: null,
          "user-agent": "npm/{npm-version} node/{node-version} {platform} {arch}",
          "read-only": false,
          "rebuild-bundle": true,
          registry: "https://registry.npmjs.org/",
          rollback: true,
          save: true,
          "save-bundle": false,
          "save-dev": false,
          "save-exact": false,
          "save-optional": false,
          "save-prefix": "^",
          "save-prod": false,
          scope: "",
          "script-shell": void 0,
          "scripts-prepend-node-path": "warn-only",
          searchopts: "",
          searchexclude: null,
          searchlimit: 20,
          searchstaleness: 15 * 60,
          "send-metrics": false,
          shell: osenv.shell(),
          shrinkwrap: true,
          "sign-git-commit": false,
          "sign-git-tag": false,
          "sso-poll-frequency": 500,
          "sso-type": "oauth",
          "strict-ssl": true,
          tag: "latest",
          "tag-version-prefix": "v",
          timing: false,
          tmp: temp,
          unicode: hasUnicode2(),
          "unsafe-perm": process.platform === "win32" || process.platform === "cygwin" || // TODO: refactor based on TS feedback
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          !(process.getuid && process.setuid && process.getgid && process.setgid) || process.getuid() !== 0,
          "update-notifier": true,
          usage: false,
          user: process.platform === "win32" || import_os4.default.type() === "OS400" ? 0 : "nobody",
          userconfig: import_path13.default.resolve(home, ".npmrc"),
          // TODO: refactor based on TS feedback
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          umask: process.umask ? process.umask() : umask.fromString("022"),
          version: false,
          versions: false,
          viewer: process.platform === "win32" ? "browser" : "man",
          _exit: true
        };
        return defaults;
      }
    });
  }
});

// libs/core/src/lib/npm-conf/index.ts
var require_npm_conf = __commonJS({
  "libs/core/src/lib/npm-conf/index.ts"(exports2, module2) {
    "use strict";
    var import_path13 = __toESM(require("path"));
    init_conf();
    init_nerf_dart();
    var { defaults } = require_defaults();
    module2.exports = npmConf3;
    module2.exports.Conf = Conf;
    module2.exports.defaults = Object.assign({}, defaults);
    module2.exports.toNerfDart = toNerfDart;
    function npmConf3(opts) {
      const conf = new Conf(Object.assign({}, defaults));
      const cleanOpts = opts ? Object.keys(opts).reduce((acc, key) => {
        if (opts[key] !== void 0) {
          acc[key] = opts[key];
        }
        return acc;
      }, {}) : {};
      conf.add(cleanOpts, "cli");
      conf.addEnv();
      conf.loadPrefix();
      const projectConf = import_path13.default.resolve(conf["localPrefix"], ".npmrc");
      const userConf = conf["get"]("userconfig");
      if (!conf["get"]("global") && projectConf !== userConf) {
        conf.addFile(projectConf, "project");
      } else {
        conf.add({}, "project");
      }
      conf.addFile(conf["get"]("userconfig"), "user");
      if (conf["get"]("prefix")) {
        const etc = import_path13.default.resolve(conf["get"]("prefix"), "etc");
        conf.root.globalconfig = import_path13.default.resolve(etc, "npmrc");
        conf.root.globalignorefile = import_path13.default.resolve(etc, "npmignore");
      }
      conf.addFile(conf["get"]("globalconfig"), "global");
      conf.loadUser();
      const caFile = conf["get"]("cafile");
      if (caFile) {
        conf.loadCAFile(caFile);
      }
      return conf;
    }
  }
});

// libs/core/src/lib/run-lifecycle.ts
var import_npmlog24, import_p_queue, runScript, npmConf, queue;
var init_run_lifecycle = __esm({
  "libs/core/src/lib/run-lifecycle.ts"() {
    "use strict";
    import_npmlog24 = __toESM(require("npmlog"));
    import_p_queue = __toESM(require("p-queue"));
    runScript = require("@npmcli/run-script");
    npmConf = require_npm_conf();
    queue = new import_p_queue.default({ concurrency: 1 });
  }
});

// libs/core/src/lib/npm-publish.ts
var import_fs_extra5, import_libnpmpublish, import_npm_package_arg5, import_npmlog25, import_pify2, readJSON, readJSONAsync;
var init_npm_publish = __esm({
  "libs/core/src/lib/npm-publish.ts"() {
    "use strict";
    import_fs_extra5 = __toESM(require("fs-extra"));
    import_libnpmpublish = require("libnpmpublish");
    import_npm_package_arg5 = __toESM(require("npm-package-arg"));
    import_npmlog25 = __toESM(require("npmlog"));
    import_pify2 = __toESM(require("pify"));
    init_otplease();
    init_run_lifecycle();
    readJSON = require("read-package-json");
    readJSONAsync = (0, import_pify2.default)(readJSON);
  }
});

// libs/core/src/lib/npm-run-script.ts
var import_npmlog26, childProcess9;
var init_npm_run_script = __esm({
  "libs/core/src/lib/npm-run-script.ts"() {
    "use strict";
    import_npmlog26 = __toESM(require("npmlog"));
    init_get_npm_exec_opts();
    childProcess9 = (init_src(), __toCommonJS(src_exports));
  }
});

// libs/core/src/lib/output.ts
var import_npmlog27;
var init_output = __esm({
  "libs/core/src/lib/output.ts"() {
    "use strict";
    import_npmlog27 = __toESM(require("npmlog"));
  }
});

// libs/core/src/lib/get-packed.ts
var import_fs_extra6, import_ssri, import_tar;
var init_get_packed = __esm({
  "libs/core/src/lib/get-packed.ts"() {
    "use strict";
    import_fs_extra6 = __toESM(require("fs-extra"));
    import_ssri = __toESM(require("ssri"));
    import_tar = __toESM(require("tar"));
  }
});

// libs/core/src/lib/temp-write.ts
async function tempWrite(fileContent, filePath) {
  const tempPath = tempfile(filePath);
  const write = (0, import_is_stream.default)(fileContent) ? writeStream : writeFileP;
  await (0, import_make_dir.default)(import_path12.default.dirname(tempPath));
  await write(tempPath, fileContent);
  return tempPath;
}
var import_graceful_fs, import_is_stream, import_make_dir, import_path12, import_temp_dir, import_util2, uuid, writeFileP, tempfile, writeStream;
var init_temp_write = __esm({
  "libs/core/src/lib/temp-write.ts"() {
    "use strict";
    import_graceful_fs = __toESM(require("graceful-fs"));
    import_is_stream = __toESM(require("is-stream"));
    import_make_dir = __toESM(require("make-dir"));
    import_path12 = __toESM(require("path"));
    import_temp_dir = __toESM(require("temp-dir"));
    import_util2 = require("util");
    uuid = __toESM(require("uuid"));
    writeFileP = (0, import_util2.promisify)(import_graceful_fs.default.writeFile);
    tempfile = (filePath) => import_path12.default.join(import_temp_dir.default, uuid.v4(), filePath || "");
    writeStream = async (filePath, fileContent) => new Promise((resolve3, reject) => {
      const writable = import_graceful_fs.default.createWriteStream(filePath);
      fileContent.on("error", (error) => {
        reject(error);
        fileContent.unpipe(writable);
        writable.end();
      }).pipe(writable).on("error", reject).on("finish", resolve3);
    });
    tempWrite.sync = (fileContent, filePath) => {
      const tempPath = tempfile(filePath);
      import_make_dir.default.sync(import_path12.default.dirname(tempPath));
      import_graceful_fs.default.writeFileSync(tempPath, fileContent);
      return tempPath;
    };
  }
});

// libs/core/src/lib/pack-directory.ts
var import_npm_packlist, import_npmlog28, import_tar2;
var init_pack_directory = __esm({
  "libs/core/src/lib/pack-directory.ts"() {
    "use strict";
    import_npm_packlist = __toESM(require("npm-packlist"));
    import_npmlog28 = __toESM(require("npmlog"));
    import_tar2 = __toESM(require("tar"));
    init_get_packed();
    init_package();
    init_run_lifecycle();
    init_temp_write();
  }
});

// libs/core/src/lib/profiler.ts
function generateProfileOutputPath(outputDirectory) {
  return import_upath.default.join(import_upath.default.resolve(outputDirectory || "."), getTimeBasedFilename());
}
var import_fs_extra7, import_npmlog29, import_upath, hrtimeToMicroseconds, range, getTimeBasedFilename, Profiler;
var init_profiler = __esm({
  "libs/core/src/lib/profiler.ts"() {
    "use strict";
    import_fs_extra7 = __toESM(require("fs-extra"));
    import_npmlog29 = __toESM(require("npmlog"));
    import_upath = __toESM(require("upath"));
    hrtimeToMicroseconds = (hrtime) => {
      return (hrtime[0] * 1e9 + hrtime[1]) / 1e3;
    };
    range = (len) => {
      return Array(len).fill().map((_, idx) => idx);
    };
    getTimeBasedFilename = () => {
      const now = /* @__PURE__ */ new Date();
      const datetime = now.toISOString().split(".")[0];
      const datetimeNormalized = datetime.replace(/-|:/g, "");
      return `Lerna-Profile-${datetimeNormalized}.json`;
    };
    Profiler = class {
      constructor({ concurrency, log: log34 = import_npmlog29.default, outputDirectory }) {
        this.events = [];
        this.logger = log34;
        this.outputPath = generateProfileOutputPath(outputDirectory);
        this.threads = range(concurrency);
      }
      run(fn, name) {
        let startTime;
        let threadId;
        return Promise.resolve().then(() => {
          startTime = process.hrtime();
          threadId = this.threads.shift();
        }).then(() => fn()).then((value) => {
          const duration = process.hrtime(startTime);
          const event = {
            name,
            ph: "X",
            ts: hrtimeToMicroseconds(startTime),
            pid: 1,
            tid: threadId,
            dur: hrtimeToMicroseconds(duration)
          };
          this.events.push(event);
          this.threads.unshift(threadId);
          this.threads.sort();
          return value;
        });
      }
      output() {
        return import_fs_extra7.default.outputJson(this.outputPath, this.events).then(() => this.logger.info("profiler", `Performance profile saved to ${this.outputPath}`));
      }
    };
  }
});

// libs/core/src/lib/pulse-till-done.ts
var import_npmlog30;
var init_pulse_till_done = __esm({
  "libs/core/src/lib/pulse-till-done.ts"() {
    "use strict";
    import_npmlog30 = __toESM(require("npmlog"));
  }
});

// libs/core/src/lib/rimraf-dir.ts
var import_npmlog31, import_rimraf;
var init_rimraf_dir = __esm({
  "libs/core/src/lib/rimraf-dir.ts"() {
    "use strict";
    import_npmlog31 = __toESM(require("npmlog"));
    import_rimraf = __toESM(require("rimraf"));
  }
});

// libs/core/src/lib/run-projects-topologically.ts
async function runProjectsTopologically(projects, projectGraph, runner, { concurrency, rejectCycles } = {}) {
  const queue2 = new import_p_queue2.default({ concurrency });
  const returnValues = [];
  const projectsMap = new Map(projects.map((p) => [p.name, p]));
  const localDependencies = projectGraph.localPackageDependencies;
  const flattenedLocalDependencies = (0, import_lodash6.flatten)(Object.values(localDependencies));
  const getProject = (name) => {
    const project = projectsMap.get(name);
    if (!project) {
      throw new Error(`Failed to find project ${name}. This is likely a bug in Lerna's toposort algorithm.`);
    }
    return project;
  };
  const dependenciesBySource = projects.reduce(
    (prev, next) => ({
      ...prev,
      [next.name]: /* @__PURE__ */ new Set()
    }),
    {}
  );
  flattenedLocalDependencies.forEach((dep) => {
    if (dependenciesBySource[dep.source] && projectsMap.has(dep.target)) {
      dependenciesBySource[dep.source].add(dep.target);
    }
  });
  const unmergedCycles = getCycles(dependenciesBySource);
  reportCycles(unmergedCycles, rejectCycles);
  const cycles = new Set(mergeOverlappingCycles(unmergedCycles));
  const seen = /* @__PURE__ */ new Set();
  const errors = [];
  const queueNextPackages = () => {
    if (seen.size === projects.length) {
      return;
    }
    let batch = Object.keys(dependenciesBySource).filter((p) => dependenciesBySource[p].size === 0).filter((p) => !seen.has(p));
    if (batch.length === 0) {
      const cycle = Array.from(cycles.values()).find((cycle2) => {
        const cycleHasExternalDependencies = cycle2.some((project) => {
          const projectDeps = dependenciesBySource[project];
          const depIsNotInCycle = (dep) => cycle2.indexOf(dep) === -1;
          return !!projectDeps && Array.from(projectDeps).filter(depIsNotInCycle).length > 0;
        });
        return !cycleHasExternalDependencies;
      });
      if (cycle) {
        cycles.delete(cycle);
        batch = cycle.filter((p) => projectsMap.has(p));
      }
    }
    batch.forEach((p) => {
      const project = getProject(p);
      seen.add(p);
      queue2.add(
        () => runner(project).then((value) => {
          returnValues.push(value);
          delete dependenciesBySource[p];
          Object.keys(dependenciesBySource).forEach((dep) => dependenciesBySource[dep].delete(p));
          queueNextPackages();
        })
      ).catch((err) => {
        errors.push(err);
      });
    });
  };
  queueNextPackages();
  await queue2.onIdle();
  if (errors.length) {
    throw errors[0];
  }
  if (seen.size !== projects.length) {
    throw new ValidationError("ERROR", "Not all tasks were run. This is likely a bug in Lerna.");
  }
  return returnValues;
}
var import_lodash6, import_p_queue2;
var init_run_projects_topologically = __esm({
  "libs/core/src/lib/run-projects-topologically.ts"() {
    "use strict";
    import_lodash6 = require("lodash");
    import_p_queue2 = __toESM(require("p-queue"));
    init_cycles();
    init_validation_error();
  }
});

// libs/core/src/lib/scm-clients/github/create-github-client.ts
var import_rest, import_git_url_parse, import_npmlog32, childProcess10;
var init_create_github_client = __esm({
  "libs/core/src/lib/scm-clients/github/create-github-client.ts"() {
    "use strict";
    import_rest = require("@octokit/rest");
    import_git_url_parse = __toESM(require("git-url-parse"));
    import_npmlog32 = __toESM(require("npmlog"));
    init_validation_error();
    childProcess10 = (init_src(), __toCommonJS(src_exports));
  }
});

// libs/core/src/lib/scm-clients/gitlab/gitlab-client.ts
var import_node_fetch, import_npmlog33;
var init_gitlab_client = __esm({
  "libs/core/src/lib/scm-clients/gitlab/gitlab-client.ts"() {
    "use strict";
    import_node_fetch = __toESM(require("node-fetch"));
    import_npmlog33 = __toESM(require("npmlog"));
  }
});

// libs/core/src/lib/scm-clients/gitlab/create-gitlab-client.ts
var import_npmlog34;
var init_create_gitlab_client = __esm({
  "libs/core/src/lib/scm-clients/gitlab/create-gitlab-client.ts"() {
    "use strict";
    import_npmlog34 = __toESM(require("npmlog"));
    init_gitlab_client();
  }
});

// libs/core/src/lib/scm-clients/index.ts
var init_scm_clients = __esm({
  "libs/core/src/lib/scm-clients/index.ts"() {
    "use strict";
    init_create_github_client();
    init_create_gitlab_client();
  }
});

// libs/core/src/lib/timer.ts
var init_timer = __esm({
  "libs/core/src/lib/timer.ts"() {
    "use strict";
  }
});

// libs/core/src/lib/npm-dist-tag.ts
var npm_dist_tag_exports = {};
__export(npm_dist_tag_exports, {
  add: () => add,
  list: () => list,
  remove: () => remove
});
function add(spec, tag, options, otpCache) {
  const opts = {
    log: import_npmlog35.default,
    ...options,
    spec: (0, import_npm_package_arg6.default)(spec)
  };
  const cleanTag = (tag || opts.defaultTag || opts.tag).trim();
  const { name, rawSpec: version } = opts.spec;
  opts.log.verbose("dist-tag", `adding "${cleanTag}" to ${name}@${version}`);
  if (opts.dryRun) {
    opts.log.silly("dist-tag", "dry-run configured, bailing now");
    return Promise.resolve();
  }
  return fetchTags(opts).then((tags) => {
    if (tags[cleanTag] === version) {
      opts.log.warn("dist-tag", `${name}@${cleanTag} already set to ${version}`);
      return tags;
    }
    const uri = `/-/package/${opts.spec.escapedName}/dist-tags/${encodeURIComponent(cleanTag)}`;
    const payload = {
      ...opts,
      method: "PUT",
      body: JSON.stringify(version),
      headers: {
        // cannot use fetch.json() due to HTTP 204 response,
        // so we manually set the required content-type
        "content-type": "application/json"
      },
      spec: opts.spec
    };
    return otplease((wrappedPayload) => (0, import_npm_registry_fetch.default)(uri, wrappedPayload), payload, otpCache).then(() => {
      opts.log.verbose("dist-tag", `added "${cleanTag}" to ${name}@${version}`);
      tags[cleanTag] = version;
      return tags;
    });
  });
}
function remove(spec, tag, options, otpCache) {
  const opts = {
    log: import_npmlog35.default,
    ...options,
    spec: (0, import_npm_package_arg6.default)(spec)
  };
  opts.log.verbose("dist-tag", `removing "${tag}" from ${opts.spec.name}`);
  if (opts.dryRun) {
    opts.log.silly("dist-tag", "dry-run configured, bailing now");
    return Promise.resolve();
  }
  return fetchTags(opts).then((tags) => {
    const version = tags[tag];
    if (!version) {
      opts.log.info("dist-tag", `"${tag}" is not a dist-tag on ${opts.spec.name}`);
      return tags;
    }
    const uri = `/-/package/${opts.spec.escapedName}/dist-tags/${encodeURIComponent(tag)}`;
    const payload = {
      ...opts,
      method: "DELETE",
      spec: opts.spec
    };
    return otplease((wrappedPayload) => (0, import_npm_registry_fetch.default)(uri, wrappedPayload), payload, otpCache).then(() => {
      opts.log.verbose("dist-tag", `removed "${tag}" from ${opts.spec.name}@${version}`);
      delete tags[tag];
      return tags;
    });
  });
}
function list(spec, options) {
  const opts = {
    log: import_npmlog35.default,
    ...options,
    spec: (0, import_npm_package_arg6.default)(spec)
  };
  if (opts.dryRun) {
    opts.log.silly("dist-tag", "dry-run configured, bailing now");
    return Promise.resolve();
  }
  return fetchTags(opts);
}
function fetchTags(opts) {
  return import_npm_registry_fetch.default.json(`/-/package/${opts.spec.escapedName}/dist-tags`, {
    ...opts,
    preferOnline: true,
    spec: opts.spec
  }).then((data) => {
    if (data && typeof data === "object") {
      delete data["_etag"];
    }
    return data || {};
  });
}
var import_npm_package_arg6, import_npm_registry_fetch, import_npmlog35;
var init_npm_dist_tag = __esm({
  "libs/core/src/lib/npm-dist-tag.ts"() {
    "use strict";
    import_npm_package_arg6 = __toESM(require("npm-package-arg"));
    import_npm_registry_fetch = __toESM(require("npm-registry-fetch"));
    import_npmlog35 = __toESM(require("npmlog"));
    init_otplease();
  }
});

// libs/core/src/index.ts
var npmConf2, npmDistTag;
var init_src2 = __esm({
  "libs/core/src/index.ts"() {
    "use strict";
    init_add_dependencies();
    init_add_dependents();
    init_check_working_tree();
    init_cli();
    init_collect_updates();
    init_command();
    init_detect_projects();
    init_is_git_initialized();
    init_conventional_commits();
    init_corepack();
    init_describe_ref();
    init_filter_options();
    init_filter_projects();
    init_get_package_manifest_path();
    init_get_packages_for_option();
    init_git_checkout();
    init_has_npm_version();
    init_listable_format_projects();
    init_listable_options();
    init_log_packed();
    init_conf();
    init_npm_install();
    init_npm_publish();
    init_npm_run_script();
    init_otplease();
    init_output();
    init_pack_directory();
    init_package();
    init_prerelease_id_from_version();
    init_profiler();
    init_project();
    init_project_graph_with_packages();
    init_prompt();
    init_pulse_till_done();
    init_rimraf_dir();
    init_run_lifecycle();
    init_run_projects_topologically();
    init_scm_clients();
    init_temp_write();
    init_timer();
    init_toposort_projects();
    init_validation_error();
    npmConf2 = require_npm_conf();
    npmDistTag = (init_npm_dist_tag(), __toCommonJS(npm_dist_tag_exports));
  }
});

// libs/commands/exec/src/index.ts
function factory(argv) {
  return new ExecCommand(argv);
}
var import_p_map3, childProcess11, ExecCommand;
var init_src3 = __esm({
  "libs/commands/exec/src/index.ts"() {
    "use strict";
    init_src2();
    import_p_map3 = __toESM(require("p-map"));
    childProcess11 = (init_src(), __toCommonJS(src_exports));
    ExecCommand = class extends Command {
      constructor() {
        super(...arguments);
        this.filteredProjects = [];
      }
      get requiresGit() {
        return false;
      }
      async initialize() {
        const dashedArgs = this.options["--"] || [];
        this.command = this.options.cmd || dashedArgs.shift();
        this.args = (this.options.args || []).concat(dashedArgs);
        if (!this.command) {
          throw new ValidationError("ENOCOMMAND", "A command to execute is required");
        }
        this.bail = this.options.bail !== false;
        this.prefix = this.options.prefix !== false;
        this.env = Object.assign({}, process.env);
        this.filteredProjects = filterProjects(this.projectGraph, this.execOpts, this.options);
        this.count = this.filteredProjects.length;
        this.packagePlural = this.count === 1 ? "package" : "packages";
        this.joinedCommand = [this.command].concat(this.args).join(" ");
      }
      async execute() {
        this.logger.info(
          "",
          "Executing command in %d %s: %j",
          this.count,
          this.packagePlural,
          this.joinedCommand
        );
        let runCommand;
        if (this.options.parallel) {
          runCommand = () => this.runCommandInPackagesParallel();
        } else if (this.toposort) {
          runCommand = () => this.runCommandInPackagesTopological();
        } else {
          runCommand = () => this.runCommandInPackagesLexical();
        }
        if (this.bail) {
          try {
            await runCommand();
          } catch (err) {
            process.exitCode = err.exitCode;
            throw err;
          }
        } else {
          const results = await runCommand();
          if (results.some((result) => result.failed)) {
            const codes = results.filter((result) => result.failed).map((result) => result.exitCode);
            const exitCode = Math.max(...codes, 1);
            this.logger.error("", "Received non-zero exit code %d during execution", exitCode);
            process.exitCode = exitCode;
          }
        }
        this.logger.success(
          "exec",
          "Executed command in %d %s: %j",
          this.count,
          this.packagePlural,
          this.joinedCommand
        );
      }
      getOpts(pkg) {
        return {
          cwd: pkg.location,
          shell: true,
          extendEnv: false,
          env: Object.assign({}, this.env, {
            LERNA_PACKAGE_NAME: pkg.name,
            LERNA_ROOT_PATH: this.project.rootPath
          }),
          reject: this.bail,
          pkg
        };
      }
      getRunner() {
        return this.options.stream ? (pkg) => this.runCommandInPackageStreaming(pkg) : (pkg) => this.runCommandInPackageCapturing(pkg);
      }
      runCommandInPackagesTopological() {
        let profiler;
        let runner;
        if (this.options.profile) {
          profiler = new Profiler({
            concurrency: this.concurrency,
            log: this.logger,
            outputDirectory: this.options.profileLocation || this.project.rootPath
          });
          const callback = this.getRunner();
          runner = (pkg) => profiler.run(() => callback(pkg), pkg.name);
        } else {
          runner = this.getRunner();
        }
        let chain = runProjectsTopologically(
          this.filteredProjects,
          this.projectGraph,
          (p) => runner(getPackage(p)),
          {
            concurrency: this.concurrency,
            rejectCycles: this.options.rejectCycles
          }
        );
        if (profiler) {
          chain = chain.then((results) => profiler.output().then(() => results));
        }
        return chain;
      }
      runCommandInPackagesParallel() {
        return (0, import_p_map3.default)(this.filteredProjects, (p) => this.runCommandInPackageStreaming(getPackage(p)));
      }
      runCommandInPackagesLexical() {
        return (0, import_p_map3.default)(this.filteredProjects, (p) => this.getRunner()(getPackage(p)), {
          concurrency: this.concurrency
        });
      }
      runCommandInPackageStreaming(pkg) {
        return childProcess11.spawnStreaming(this.command, this.args, this.getOpts(pkg), this.prefix && pkg.name);
      }
      runCommandInPackageCapturing(pkg) {
        return childProcess11.spawn(this.command, this.args, this.getOpts(pkg));
      }
    };
  }
});

// libs/commands/exec/src/command.ts
var require_command = __commonJS({
  "libs/commands/exec/src/command.ts"(exports2, module2) {
    "use strict";
    init_src2();
    init_src3();
    var command = {
      command: "exec [cmd] [args..]",
      describe: "Execute an arbitrary command in each package",
      builder(yargs2) {
        yargs2.example("$0 exec ls -- --la", "# execute `ls -la` in all packages").example("$0 exec -- ls --la", "# execute `ls -la` in all packages, keeping cmd outside").parserConfiguration({
          "populate--": true
        }).positional("cmd", {
          describe: "The command to execute. Any command flags must be passed after --",
          type: "string"
        }).positional("args", {
          describe: "Positional arguments (not recognized by lerna) to send to command",
          type: "string"
        }).options({
          stream: {
            group: "Command Options:",
            describe: "Stream output with lines prefixed by originating package name.",
            type: "boolean"
          },
          parallel: {
            group: "Command Options:",
            describe: "Execute command with unlimited concurrency, streaming prefixed output.",
            type: "boolean"
          },
          "no-bail": {
            group: "Command Options:",
            describe: "Continue executing command despite non-zero exit in a given package.",
            type: "boolean"
          },
          bail: {
            // proxy for --no-bail
            hidden: true,
            type: "boolean"
          },
          // This option controls prefix for stream output so that it can be disabled to be friendly
          // to tools like Visual Studio Code to highlight the raw results
          "no-prefix": {
            group: "Command Options:",
            describe: "Do not prefix streaming output.",
            type: "boolean"
          },
          prefix: {
            // proxy for --no-prefix
            hidden: true,
            type: "boolean"
          },
          profile: {
            group: "Command Options:",
            describe: "Profile command executions and output performance profile to default location.",
            type: "boolean"
          },
          "profile-location": {
            group: "Command Options:",
            describe: "Output performance profile to custom location instead of default project root.",
            type: "string"
          }
        });
        return filterOptions(yargs2);
      },
      async handler(argv) {
        return factory(argv);
      }
    };
    module2.exports = command;
  }
});

// packages/lerna/src/commands/exec/command.ts
var import_command2 = __toESM(require_command());
module.exports = import_command2.default;
