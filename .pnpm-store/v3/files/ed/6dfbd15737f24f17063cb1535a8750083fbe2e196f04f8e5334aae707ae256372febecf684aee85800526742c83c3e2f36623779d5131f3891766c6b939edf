'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var pluginutils = require('@rollup/pluginutils');
var core = require('@swc/core');
var smob = require('smob');

function swc(input = {}) {
    var _a;
    const filter = pluginutils.createFilter(input.include, input.exclude);
    const defaults = {
        jsc: {
            target: 'es2020',
            parser: {
                syntax: 'typescript',
                decorators: true
            },
            transform: {
                decoratorMetadata: true,
                legacyDecorator: true
            },
            loose: true
        }
    };
    if (input.swc && input.swc.env) {
        (_a = defaults.jsc) === null || _a === void 0 ? true : delete _a.target;
    }
    const swcOptions = smob.merge({}, input.swc || {}, defaults);
    return {
        name: 'swc',
        transform(code, id) {
            if (!filter(id))
                return null;
            return core.transform(code, {
                ...swcOptions,
                sourceMaps: true
            });
        }
    };
}

exports.default = swc;
exports.swc = swc;
module.exports = Object.assign(exports.default, exports);
//# sourceMappingURL=index.js.map
