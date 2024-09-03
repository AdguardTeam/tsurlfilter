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
  let dir = import_path8.default.resolve(start);
  let walkedUp = false;
  while (import_path8.default.basename(dir) === "node_modules") {
    dir = import_path8.default.dirname(dir);
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
    const dirname = import_path8.default.dirname(name);
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
var import_fs3, import_path8;
var init_find_prefix = __esm({
  "libs/core/src/lib/npm-conf/find-prefix.ts"() {
    "use strict";
    import_fs3 = __toESM(require("fs"));
    import_path8 = __toESM(require("path"));
  }
});

// libs/core/src/lib/npm-conf/types.ts
var require_types = __commonJS({
  "libs/core/src/lib/npm-conf/types.ts"(exports) {
    "use strict";
    var import_path12 = __toESM(require("path"));
    var import_stream = require("stream");
    var import_url2 = __toESM(require("url"));
    var Umask = () => {
    };
    var getLocalAddresses = () => [];
    var semver4 = () => {
    };
    exports.types = {
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
      cafile: import_path12.default,
      cache: import_path12.default,
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
      globalconfig: import_path12.default,
      "global-style": Boolean,
      group: [Number, String],
      "https-proxy": [null, import_url2.default],
      "user-agent": String,
      "ham-it-up": Boolean,
      heading: String,
      "if-present": Boolean,
      "ignore-prepublish": Boolean,
      "ignore-scripts": Boolean,
      "init-module": import_path12.default,
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
      prefix: import_path12.default,
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
      tmp: import_path12.default,
      unicode: Boolean,
      "unsafe-perm": Boolean,
      "update-notifier": Boolean,
      usage: Boolean,
      user: [Number, String],
      userconfig: import_path12.default,
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
  const isPath = typeList.indexOf(import_path9.default) !== -1;
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
      field = import_path9.default.resolve(process.env["HOME"], field.substr(2));
    }
    field = import_path9.default.resolve(field);
  }
  if (isNumber && !Number.isNaN(field)) {
    field = Number(field);
  }
  return field;
}
var import_path9, types;
var init_parse_field = __esm({
  "libs/core/src/lib/npm-conf/parse-field.ts"() {
    "use strict";
    import_path9 = __toESM(require("path"));
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
  "libs/core/src/lib/npm-conf/config-chain/proto-list.ts"(exports, module2) {
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
  "libs/core/src/lib/npm-conf/config-chain/index.ts"(exports, module2) {
    "use strict";
    var ProtoList = require_proto_list();
    var path10 = require("path");
    var fs12 = require("fs");
    var ini = require("ini");
    var EE = require("events").EventEmitter;
    var url2 = require("url");
    var http = require("http");
    var exports = module2.exports = function() {
      var args = [].slice.call(arguments), conf = new ConfigChain2();
      while (args.length) {
        var a = args.shift();
        if (a)
          conf.push("string" === typeof a ? json(a) : a);
      }
      return conf;
    };
    var find2 = exports.find = function() {
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
    var parse = exports.parse = function(content, file, type) {
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
    var json = exports.json = function() {
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
      return parse(content, file, "json");
    };
    var env = exports.env = function(prefix, env2) {
      env2 = env2 || process.env;
      var obj = {};
      var l = prefix.length;
      for (var k in env2) {
        if (k.indexOf(prefix) === 0)
          obj[k.substring(l)] = env2[k];
      }
      return obj;
    };
    exports.ConfigChain = ConfigChain2;
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
      var data = exports.env(prefix, env2);
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
    ConfigChain2.prototype.parse = exports.parse;
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
var import_assert, import_fs4, import_path10, ConfigChain, Conf;
var init_conf = __esm({
  "libs/core/src/lib/npm-conf/conf.ts"() {
    "use strict";
    import_assert = __toESM(require("assert"));
    import_fs4 = __toESM(require("fs"));
    import_path10 = __toESM(require("path"));
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
          get: () => import_path10.default.resolve(this["get"]("prefix"))
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
          p = import_path10.default.resolve(cli.prefix);
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
        const prefix = import_path10.default.resolve(this["get"]("prefix"));
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
  "libs/core/src/lib/npm-conf/defaults.ts"(exports) {
    "use strict";
    var import_os4 = __toESM(require("os"));
    var import_path12 = __toESM(require("path"));
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
      home = import_path12.default.resolve(temp, `npm-${uidOrPid}`);
    }
    var cacheExtra = process.platform === "win32" ? "npm-cache" : ".npm";
    var cacheRoot = process.platform === "win32" && process.env["APPDATA"] || home;
    var cache = import_path12.default.resolve(cacheRoot, cacheExtra);
    var defaults;
    var globalPrefix;
    Object.defineProperty(exports, "defaults", {
      get() {
        if (defaults) {
          return defaults;
        }
        if (process.env["PREFIX"]) {
          globalPrefix = process.env["PREFIX"];
        } else if (process.platform === "win32") {
          globalPrefix = import_path12.default.dirname(process.execPath);
        } else {
          globalPrefix = import_path12.default.dirname(import_path12.default.dirname(process.execPath));
          if (process.env["DESTDIR"]) {
            globalPrefix = import_path12.default.join(process.env["DESTDIR"], globalPrefix);
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
          globalconfig: import_path12.default.resolve(globalPrefix, "etc", "npmrc"),
          "global-style": false,
          group: process.platform === "win32" ? 0 : process.env["SUDO_GID"] || process.getgid && process.getgid(),
          "ham-it-up": false,
          heading: "npm",
          "if-present": false,
          "ignore-prepublish": false,
          "ignore-scripts": false,
          "init-module": import_path12.default.resolve(home, ".npm-init.js"),
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
          userconfig: import_path12.default.resolve(home, ".npmrc"),
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
  "libs/core/src/lib/npm-conf/index.ts"(exports, module2) {
    "use strict";
    var import_path12 = __toESM(require("path"));
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
      const projectConf = import_path12.default.resolve(conf["localPrefix"], ".npmrc");
      const userConf = conf["get"]("userconfig");
      if (!conf["get"]("global") && projectConf !== userConf) {
        conf.addFile(projectConf, "project");
      } else {
        conf.add({}, "project");
      }
      conf.addFile(conf["get"]("userconfig"), "user");
      if (conf["get"]("prefix")) {
        const etc = import_path12.default.resolve(conf["get"]("prefix"), "etc");
        conf.root.globalconfig = import_path12.default.resolve(etc, "npmrc");
        conf.root.globalignorefile = import_path12.default.resolve(etc, "npmignore");
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

// packages/lerna/src/commands/diff/index.ts
var diff_exports = {};
__export(diff_exports, {
  DiffCommand: () => DiffCommand,
  factory: () => factory
});
module.exports = __toCommonJS(diff_exports);

// libs/core/src/lib/add-dependents.ts
var import_lodash = require("lodash");

// libs/core/src/lib/collect-uncommitted.ts
var import_chalk2 = __toESM(require("chalk"));
var import_npmlog = __toESM(require("npmlog"));
var childProcess = (init_src(), __toCommonJS(src_exports));
var maybeColorize = (colorize) => (s) => s !== " " ? colorize(s) : s;
var cRed = maybeColorize(import_chalk2.default.red);
var cGreen = maybeColorize(import_chalk2.default.green);
var replaceStatus = (_, maybeGreen, maybeRed) => `${cGreen(maybeGreen)}${cRed(maybeRed)}`;
var colorizeStats = (stats) => stats.replace(/^([^U]| )([A-Z]| )/gm, replaceStatus).replace(/^\?{2}|U{2}/gm, cRed("$&"));
var splitOnNewLine = (str) => str.split("\n");
var filterEmpty = (lines) => lines.filter((line) => line.length);
var o = (l, r) => (x) => l(r(x));
var transformOutput = o(filterEmpty, o(splitOnNewLine, colorizeStats));
function collectUncommitted({ cwd, log: log36 = import_npmlog.default }) {
  log36.silly("collect-uncommitted", "git status --porcelain (async)");
  return childProcess.exec("git", ["status", "--porcelain"], { cwd }).then(({ stdout }) => transformOutput(stdout));
}

// libs/core/src/lib/describe-ref.ts
var import_npmlog2 = __toESM(require("npmlog"));
var childProcess2 = (init_src(), __toCommonJS(src_exports));

// libs/core/src/lib/validation-error.ts
var import_npmlog3 = __toESM(require("npmlog"));
var ValidationError = class extends Error {
  constructor(prefix, message, ...rest) {
    super(message);
    this.name = "ValidationError";
    this.prefix = prefix;
    import_npmlog3.default.resume();
    import_npmlog3.default.error(prefix, message, ...rest);
  }
};

// libs/core/src/lib/check-working-tree.ts
var EUNCOMMIT_MSG = "Working tree has uncommitted changes, please commit or remove the following changes before continuing:\n";
function mkThrowIfUncommitted(options = {}) {
  return function throwIfUncommitted2(opts) {
    if (opts.isDirty) {
      return collectUncommitted(options).then((uncommitted) => {
        throw new ValidationError("EUNCOMMIT", `${EUNCOMMIT_MSG}${uncommitted.join("\n")}`);
      });
    }
  };
}
var throwIfUncommitted = mkThrowIfUncommitted();

// libs/core/src/lib/cli.ts
var import_dedent = __toESM(require("dedent"));
var import_npmlog4 = __toESM(require("npmlog"));
var import_yargs = __toESM(require("yargs"));

// libs/core/src/lib/collect-updates/collect-project-updates.ts
var import_lodash2 = require("lodash");
var import_npmlog7 = __toESM(require("npmlog"));

// libs/core/src/lib/prerelease-id-from-version.ts
var import_semver = __toESM(require("semver"));

// libs/core/src/lib/project-graph-with-packages.ts
var isExternalNpmDependency = (dep) => dep.startsWith("npm:");
function getPackage(project) {
  if (!project.package) {
    throw new Error(`Failed attempting to find package for project ${project.name}`);
  }
  return project.package;
}

// libs/core/src/lib/collect-updates/has-tags.ts
var import_npmlog5 = __toESM(require("npmlog"));
var childProcess3 = (init_src(), __toCommonJS(src_exports));

// libs/core/src/lib/collect-updates/make-diff-predicate.ts
var import_minimatch = __toESM(require("minimatch"));
var import_npmlog6 = __toESM(require("npmlog"));
var import_slash = __toESM(require("slash"));
var { execSync: execSync2 } = (init_src(), __toCommonJS(src_exports));

// libs/core/src/lib/command/index.ts
var import_clone_deep = __toESM(require("clone-deep"));
var import_dedent3 = __toESM(require("dedent"));
var import_npmlog12 = __toESM(require("npmlog"));
var import_client = require("nx/src/daemon/client/client");
var import_os3 = __toESM(require("os"));

// libs/core/src/lib/project/index.ts
var import_devkit2 = require("@nx/devkit");
var import_cosmiconfig = require("cosmiconfig");
var import_dedent2 = __toESM(require("dedent"));
var import_fs2 = __toESM(require("fs"));
var import_glob_parent = __toESM(require("glob-parent"));
var import_globby2 = __toESM(require("globby"));
var import_js_yaml = require("js-yaml");
var import_load_json_file2 = __toESM(require("load-json-file"));
var import_npmlog8 = __toESM(require("npmlog"));
var import_p_map2 = __toESM(require("p-map"));
var import_path4 = __toESM(require("path"));

// libs/core/src/lib/package.ts
var import_devkit = require("@nx/devkit");
var import_fs = __toESM(require("fs"));
var import_load_json_file = __toESM(require("load-json-file"));
var import_npm_package_arg = __toESM(require("npm-package-arg"));
var import_path = __toESM(require("path"));
var import_write_pkg = __toESM(require("write-pkg"));
var PKG = Symbol("pkg");
var _location = Symbol("location");
var _resolved = Symbol("resolved");
var _rootPath = Symbol("rootPath");
var _scripts = Symbol("scripts");
var _contents = Symbol("contents");
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
var Package = class _Package {
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
      const location = import_path.default.resolve(import_path.default.basename(ref) === "package.json" ? import_path.default.dirname(ref) : ref);
      const manifest = import_load_json_file.default.sync(import_path.default.join(location, "package.json"));
      return new _Package(manifest, location);
    }
    if ("__isLernaPackage" in ref) {
      return ref;
    }
    return new _Package(ref, dir);
  }
  constructor(pkg, location, rootPath = location) {
    const resolved = import_npm_package_arg.default.resolve(pkg.name, `file:${import_path.default.relative(rootPath, location)}`, rootPath);
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
    return import_path.default.join(this.location, "node_modules", ".bin");
  }
  get manifestLocation() {
    return import_path.default.join(this.location, "package.json");
  }
  get nodeModulesLocation() {
    return import_path.default.join(this.location, "node_modules");
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
      return import_path.default.join(this.location, this[PKG].publishConfig.directory);
    }
    return this.location;
  }
  set contents(subDirectory) {
    const _workspaceRoot = process.env["NX_WORKSPACE_ROOT_PATH"] || import_devkit.workspaceRoot;
    if (subDirectory.startsWith(_workspaceRoot)) {
      this[_contents] = subDirectory;
      return;
    }
    this[_contents] = import_path.default.join(this.location, subDirectory);
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
      const distPkg = import_path.default.join(this.contents, "package.json");
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

// libs/core/src/lib/project/apply-extends.ts
var import_path2 = __toESM(require("path"));
var import_resolve_from = __toESM(require("resolve-from"));

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
    defaultConfig = applyExtends(defaultConfig, import_path2.default.dirname(pathToDefault), seen);
  }
  return shallowExtend(config, defaultConfig);
}

// libs/core/src/lib/project/make-file-finder.ts
var import_globby = __toESM(require("globby"));
var import_p_map = __toESM(require("p-map"));
var import_path3 = __toESM(require("path"));
function normalize(results) {
  return results.map((fp) => import_path3.default.normalize(fp));
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
        let chain = (0, import_globby.default)(import_path3.default.posix.join(globPath, fileName), options);
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
    const patterns = packageConfigs.map((globPath) => import_path3.default.posix.join(globPath, fileName)).sort();
    let results = import_globby.default.sync(patterns, globOpts);
    results = normalize(results);
    return results.map((res) => fileMapper(res));
  };
}

// libs/core/src/lib/project/index.ts
var LICENSE_GLOB = "LICEN{S,C}E{,.*}";
var Project = class _Project {
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
    this.rootPath = import_path4.default.dirname(filepath);
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
    return this.packageConfigs.map((packagePattern) => (0, import_glob_parent.default)(packagePattern)).map((parentDir) => import_path4.default.resolve(this.rootPath, parentDir));
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
        licensePath = import_path4.default.normalize(licensePath);
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
      (packageJson) => new Package(packageJson, import_path4.default.dirname(packageConfigPath), this.rootPath)
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
        import_path4.default.dirname(packageConfigPath),
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
      const manifestLocation = import_path4.default.join(this.rootPath, "package.json");
      const packageJson = import_load_json_file2.default.sync(manifestLocation);
      if (!packageJson.name) {
        packageJson.name = import_path4.default.basename(import_path4.default.dirname(manifestLocation));
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
              filepath: import_path4.default.resolve(cwd || ".", "lerna.json")
            };
            return configNotFoundResult;
          }
          obj.config = applyExtends(obj.config, import_path4.default.dirname(obj.filepath));
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
      const configLocation = import_path4.default.join(this.rootPath, "pnpm-workspace.yaml");
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
var getPackages = Project.getPackages;
var getPackagesSync = Project.getPackagesSync;

// libs/core/src/lib/write-log-file.ts
var import_npmlog9 = __toESM(require("npmlog"));
var import_os2 = __toESM(require("os"));
var import_path5 = __toESM(require("path"));
var import_write_file_atomic = __toESM(require("write-file-atomic"));
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
  import_write_file_atomic.default.sync(import_path5.default.join(cwd, "lerna-debug.log"), logOutput);
  import_npmlog9.default.record.length = 0;
}

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

// libs/core/src/lib/command/detect-projects.ts
var import_devkit4 = require("@nx/devkit");

// libs/core/src/lib/command/create-project-graph-with-packages.ts
var import_devkit3 = require("@nx/devkit");
var import_fs_extra = require("fs-extra");
var import_lodash3 = require("lodash");
var import_minimatch2 = __toESM(require("minimatch"));
var import_npm_package_arg2 = require("npm-package-arg");
var import_path7 = require("path");
var import_semver2 = require("semver");

// libs/core/src/lib/get-package-manifest-path.ts
var import_path6 = require("path");
function getPackageManifestPath(node, files) {
  const pkgJsonPath = (0, import_path6.resolve)((0, import_path6.join)(node.data.root, "package.json"));
  return files.find((f) => (0, import_path6.resolve)(f.file) === pkgJsonPath)?.file;
}

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
          const fullManifestPath = (0, import_path7.join)(_workspaceRoot, manifestPath);
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
      pkg = new Package(manifest, (0, import_path7.join)(_workspaceRoot, node.data.root), _workspaceRoot);
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
var resolvePackage = (name, version, spec, location) => {
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

// libs/core/src/lib/command/is-git-initialized.ts
var import_execa2 = __toESM(require("execa"));
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

// libs/core/src/lib/command/log-package-error.ts
var import_npmlog10 = __toESM(require("npmlog"));
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

// libs/core/src/lib/command/warn-if-hanging.ts
var import_npmlog11 = __toESM(require("npmlog"));
var childProcess4 = (init_src(), __toCommonJS(src_exports));
function warnIfHanging() {
  const childProcessCount = childProcess4.getChildProcessCount();
  if (childProcessCount > 0) {
    import_npmlog11.default.warn(
      "complete",
      `Waiting for ${childProcessCount} child process${childProcessCount === 1 ? "" : "es"} to exit. CTRL-C to exit immediately.`
    );
  }
}

// libs/core/src/lib/command/index.ts
var DEFAULT_CONCURRENCY = import_os3.default.cpus().length;
var Command = class _Command {
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

// libs/core/src/lib/conventional-commits/recommend-version.ts
var import_conventional_recommended_bump = __toESM(require("conventional-recommended-bump"));
var import_npmlog14 = __toESM(require("npmlog"));
var import_semver3 = __toESM(require("semver"));

// libs/core/src/lib/conventional-commits/get-changelog-config.ts
var import_npm_package_arg3 = __toESM(require("npm-package-arg"));
var import_npmlog13 = __toESM(require("npmlog"));
var import_pify = __toESM(require("pify"));

// libs/core/src/lib/conventional-commits/update-changelog.ts
var import_conventional_changelog_core = __toESM(require("conventional-changelog-core"));
var import_fs_extra3 = __toESM(require("fs-extra"));
var import_get_stream = __toESM(require("get-stream"));
var import_npmlog15 = __toESM(require("npmlog"));

// libs/core/src/lib/conventional-commits/constants.ts
var EOL = "\n";
var BLANK_LINE = EOL + EOL;
var COMMIT_GUIDELINE = "See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.";
var CHANGELOG_HEADER = [
  "# Change Log",
  "",
  "All notable changes to this project will be documented in this file.",
  COMMIT_GUIDELINE
].join(EOL);

// libs/core/src/lib/conventional-commits/read-existing-changelog.ts
var import_fs_extra2 = __toESM(require("fs-extra"));

// libs/core/src/lib/corepack/exec-package-manager.ts
var childProcess5 = (init_src(), __toCommonJS(src_exports));

// libs/core/src/lib/filter-options.ts
var import_dedent4 = __toESM(require("dedent"));
var import_npmlog16 = __toESM(require("npmlog"));

// libs/core/src/lib/filter-projects.ts
var import_multimatch = __toESM(require("multimatch"));
var import_npmlog17 = __toESM(require("npmlog"));

// libs/core/src/lib/git-checkout.ts
var import_npmlog18 = __toESM(require("npmlog"));
var childProcess6 = (init_src(), __toCommonJS(src_exports));

// libs/core/src/lib/has-npm-version.ts
var import_semver4 = __toESM(require("semver"));
var childProcess7 = (init_src(), __toCommonJS(src_exports));

// libs/core/src/lib/listable-format-projects.ts
var import_chalk3 = __toESM(require("chalk"));
var import_columnify = __toESM(require("columnify"));

// libs/core/src/lib/toposort-projects.ts
var import_lodash5 = require("lodash");

// libs/core/src/lib/cycles/merge-overlapping-cycles.ts
var import_lodash4 = require("lodash");

// libs/core/src/lib/cycles/report-cycles.ts
var import_npmlog19 = __toESM(require("npmlog"));

// libs/core/src/lib/log-packed.ts
var import_byte_size = __toESM(require("byte-size"));
var import_columnify2 = __toESM(require("columnify"));
var import_npmlog20 = __toESM(require("npmlog"));
var import_has_unicode = __toESM(require("has-unicode"));
var hasUnicode = (0, import_has_unicode.default)();

// libs/core/src/index.ts
init_conf();

// libs/core/src/lib/npm-install.ts
var import_fs_extra4 = __toESM(require("fs-extra"));
var import_npm_package_arg4 = __toESM(require("npm-package-arg"));
var import_npmlog22 = __toESM(require("npmlog"));
var import_signal_exit = __toESM(require("signal-exit"));
var import_write_pkg2 = __toESM(require("write-pkg"));

// libs/core/src/lib/get-npm-exec-opts.ts
var import_npmlog21 = __toESM(require("npmlog"));
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

// libs/core/src/lib/npm-install.ts
var childProcess8 = (init_src(), __toCommonJS(src_exports));
module.exports.npmInstallDependencies = npmInstallDependencies;
function npmInstall(pkg, { registry, npmClient, npmClientArgs, npmGlobalStyle, mutex, stdio = "pipe", subCommand = "install" }) {
  const opts = getNpmExecOpts(pkg, registry);
  const args = [subCommand];
  let cmd = npmClient || "npm";
  if (npmGlobalStyle) {
    cmd = "npm";
    args.push("--global-style");
  }
  if (cmd === "yarn" && mutex) {
    args.push("--mutex", mutex);
  }
  if (cmd === "yarn") {
    args.push("--non-interactive");
  }
  if (npmClientArgs && npmClientArgs.length) {
    args.push(...npmClientArgs);
  }
  opts.stdio = stdio;
  opts.env.LERNA_EXEC_PATH = pkg.location;
  opts.env.LERNA_ROOT_PATH = pkg.rootPath;
  import_npmlog22.default.silly("npmInstall", [cmd, args]);
  return childProcess8.exec(cmd, args, opts);
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

// libs/core/src/lib/npm-publish.ts
var import_fs_extra5 = __toESM(require("fs-extra"));
var import_libnpmpublish = require("libnpmpublish");
var import_npm_package_arg5 = __toESM(require("npm-package-arg"));
var import_npmlog25 = __toESM(require("npmlog"));
var import_pify2 = __toESM(require("pify"));
init_otplease();

// libs/core/src/lib/run-lifecycle.ts
var import_npmlog24 = __toESM(require("npmlog"));
var import_p_queue = __toESM(require("p-queue"));
var runScript = require("@npmcli/run-script");
var npmConf = require_npm_conf();
var queue = new import_p_queue.default({ concurrency: 1 });

// libs/core/src/lib/npm-publish.ts
var readJSON = require("read-package-json");
var readJSONAsync = (0, import_pify2.default)(readJSON);

// libs/core/src/lib/npm-run-script.ts
var import_npmlog26 = __toESM(require("npmlog"));
var childProcess9 = (init_src(), __toCommonJS(src_exports));

// libs/core/src/index.ts
init_otplease();

// libs/core/src/lib/output.ts
var import_npmlog27 = __toESM(require("npmlog"));

// libs/core/src/lib/pack-directory.ts
var import_npm_packlist = __toESM(require("npm-packlist"));
var import_npmlog28 = __toESM(require("npmlog"));
var import_tar2 = __toESM(require("tar"));

// libs/core/src/lib/get-packed.ts
var import_fs_extra6 = __toESM(require("fs-extra"));
var import_ssri = __toESM(require("ssri"));
var import_tar = __toESM(require("tar"));

// libs/core/src/lib/temp-write.ts
var import_graceful_fs = __toESM(require("graceful-fs"));
var import_is_stream = __toESM(require("is-stream"));
var import_make_dir = __toESM(require("make-dir"));
var import_path11 = __toESM(require("path"));
var import_temp_dir = __toESM(require("temp-dir"));
var import_util = require("util");
var uuid = __toESM(require("uuid"));
var writeFileP = (0, import_util.promisify)(import_graceful_fs.default.writeFile);
var tempfile = (filePath) => import_path11.default.join(import_temp_dir.default, uuid.v4(), filePath || "");
var writeStream = async (filePath, fileContent) => new Promise((resolve3, reject) => {
  const writable = import_graceful_fs.default.createWriteStream(filePath);
  fileContent.on("error", (error) => {
    reject(error);
    fileContent.unpipe(writable);
    writable.end();
  }).pipe(writable).on("error", reject).on("finish", resolve3);
});
async function tempWrite(fileContent, filePath) {
  const tempPath = tempfile(filePath);
  const write = (0, import_is_stream.default)(fileContent) ? writeStream : writeFileP;
  await (0, import_make_dir.default)(import_path11.default.dirname(tempPath));
  await write(tempPath, fileContent);
  return tempPath;
}
tempWrite.sync = (fileContent, filePath) => {
  const tempPath = tempfile(filePath);
  import_make_dir.default.sync(import_path11.default.dirname(tempPath));
  import_graceful_fs.default.writeFileSync(tempPath, fileContent);
  return tempPath;
};

// libs/core/src/lib/profiler.ts
var import_fs_extra7 = __toESM(require("fs-extra"));
var import_npmlog29 = __toESM(require("npmlog"));
var import_upath = __toESM(require("upath"));

// libs/core/src/index.ts
init_prompt();

// libs/core/src/lib/pulse-till-done.ts
var import_npmlog30 = __toESM(require("npmlog"));

// libs/core/src/lib/rimraf-dir.ts
var import_npmlog31 = __toESM(require("npmlog"));
var import_rimraf = __toESM(require("rimraf"));

// libs/core/src/lib/run-projects-topologically.ts
var import_lodash6 = require("lodash");
var import_p_queue2 = __toESM(require("p-queue"));

// libs/core/src/lib/scm-clients/github/create-github-client.ts
var import_rest = require("@octokit/rest");
var import_git_url_parse = __toESM(require("git-url-parse"));
var import_npmlog32 = __toESM(require("npmlog"));
var childProcess10 = (init_src(), __toCommonJS(src_exports));

// libs/core/src/lib/scm-clients/gitlab/create-gitlab-client.ts
var import_npmlog34 = __toESM(require("npmlog"));

// libs/core/src/lib/scm-clients/gitlab/gitlab-client.ts
var import_node_fetch = __toESM(require("node-fetch"));
var import_npmlog33 = __toESM(require("npmlog"));

// libs/core/src/index.ts
var npmConf2 = require_npm_conf();
var npmDistTag = (init_npm_dist_tag(), __toCommonJS(npm_dist_tag_exports));

// libs/commands/diff/src/lib/get-last-commit.ts
var import_npmlog36 = __toESM(require("npmlog"));
init_src();
function getLastCommit(execOpts) {
  if (hasTags2(execOpts)) {
    import_npmlog36.default.silly("getLastTagInBranch", "");
    return execSync("git", ["describe", "--tags", "--abbrev=0"], execOpts);
  }
  import_npmlog36.default.silly("getFirstCommit", "");
  return execSync("git", ["rev-list", "--max-parents=0", "HEAD"], execOpts);
}
function hasTags2(opts) {
  let result = false;
  try {
    result = !!execSync("git", ["tag"], opts);
  } catch (err) {
    import_npmlog36.default.warn("ENOTAGS", "No git tags were reachable from this branch!");
    import_npmlog36.default.verbose("hasTags error", err);
  }
  import_npmlog36.default.verbose("hasTags", result.toString());
  return result;
}

// libs/commands/diff/src/lib/has-commit.ts
var import_npmlog37 = __toESM(require("npmlog"));
init_src();
function hasCommit(opts) {
  import_npmlog37.default.silly("hasCommit", "");
  let retVal;
  try {
    execSync("git", ["log"], opts);
    retVal = true;
  } catch (e) {
    retVal = false;
  }
  import_npmlog37.default.verbose("hasCommit", retVal.toString());
  return retVal;
}

// libs/commands/diff/src/index.ts
init_src();
function factory(argv) {
  return new DiffCommand(argv);
}
var DiffCommand = class extends Command {
  constructor() {
    super(...arguments);
    this.args = [];
  }
  initialize() {
    const packageName = this.options.pkgName;
    let targetPackage;
    if (packageName) {
      const project = Object.values(this.projectGraph.nodes).find(
        (p) => p.package && getPackage(p).name === packageName
      );
      targetPackage = project && getPackage(project);
      if (!targetPackage) {
        throw new ValidationError("ENOPKG", `Cannot diff, the package '${packageName}' does not exist.`);
      }
    }
    if (!hasCommit(this.execOpts)) {
      throw new ValidationError("ENOCOMMITS", "Cannot diff, there are no commits in this repository yet.");
    }
    const args = ["diff", getLastCommit(this.execOpts), "--color=auto"];
    if (targetPackage) {
      args.push("--", targetPackage.location);
    } else {
      args.push("--", ...this.project.packageParentDirs);
    }
    if (this.options.ignoreChanges) {
      this.options.ignoreChanges.forEach((ignorePattern) => {
        args.push(`:(exclude,glob)${ignorePattern}`);
      });
    }
    this.args = args;
  }
  execute() {
    return spawn("git", this.args, this.execOpts).catch((err) => {
      if (err.exitCode) {
        throw err;
      }
    });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DiffCommand,
  factory
});
