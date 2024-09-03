import { createFilter } from '@rollup/pluginutils';
import { transform } from '@swc/core';
import { merge } from 'smob';

function swc(input = {}) {
    var _a;
    const filter = createFilter(input.include, input.exclude);
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
    const swcOptions = merge({}, input.swc || {}, defaults);
    return {
        name: 'swc',
        transform(code, id) {
            if (!filter(id))
                return null;
            return transform(code, {
                ...swcOptions,
                sourceMaps: true
            });
        }
    };
}

export { swc as default, swc };
//# sourceMappingURL=index.js.map
