"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var magic_string_1 = __importDefault(require("magic-string"));
var SHEBANG_RX = /^#!.*/;
exports.preserveShebangs = function () {
    var shebangs = {};
    var plugin = {
        name: 'rollup-plugin-preserve-shebangs',
        transform: function (code, id) {
            var match = code.match(SHEBANG_RX);
            if (match) {
                shebangs[id] = match[0];
            }
            code = code.replace(SHEBANG_RX, '');
            return {
                code: code,
                map: null,
            };
        },
        renderChunk: function (code, chunk, _a) {
            var sourcemap = _a.sourcemap;
            if (chunk.facadeModuleId && shebangs[chunk.facadeModuleId]) {
                var str = new magic_string_1.default(code);
                str.prepend(shebangs[chunk.facadeModuleId] + '\n');
                return {
                    code: str.toString(),
                    map: sourcemap ? str.generateMap({ hires: true }) : null,
                };
            }
            return {
                code: code,
                map: null,
            };
        },
    };
    return plugin;
};
