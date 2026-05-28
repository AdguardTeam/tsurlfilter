import { describe, expect, it } from 'vitest';

import { ScriptletParams } from '../../src/rules/scriptlet-params';

describe('ScriptletParams', () => {
    describe('toString', () => {
        it('returns empty scriptlet call when no name', () => {
            const params = new ScriptletParams();
            expect(params.toString()).toBe('//scriptlet()');
        });

        it('returns scriptlet call with name only', () => {
            const params = new ScriptletParams('set-cookie');
            expect(params.toString()).toBe("//scriptlet('set-cookie')");
        });

        it('returns scriptlet call with name and args', () => {
            const params = new ScriptletParams('set-cookie', ['test', 'true']);
            expect(params.toString()).toBe("//scriptlet('set-cookie', 'test', 'true')");
        });

        it('normalizes double quotes to single quotes', () => {
            const params = new ScriptletParams('set-cookie', ['test']);
            expect(params.toString()).toBe("//scriptlet('set-cookie', 'test')");
        });
    });
});
