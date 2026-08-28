import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const PARSER_ROOT = new URL('../../src/parser/', import.meta.url).pathname;

/**
 * Recursively collect all `.ts` files under a directory.
 *
 * @param dir Directory to walk.
 * @param out Accumulator array (used for recursion).
 *
 * @returns The array of collected file paths.
 */
function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) {
            walk(p, out);
        } else if (p.endsWith('.ts') && !p.endsWith('.d.ts')) {
            out.push(p);
        }
    }
    return out;
}

describe('parser contract coverage', () => {
    it('every exported *Parser class declares an implements clause', () => {
        const offenders: string[] = [];
        const classRe = /^export\s+class\s+(\w*Parser)\b([^{]*)\{/gm;

        for (const file of walk(PARSER_ROOT)) {
            const src = readFileSync(file, 'utf8');
            let m: RegExpExecArray | null;
            classRe.lastIndex = 0;
            // eslint-disable-next-line no-cond-assign
            while ((m = classRe.exec(src))) {
                const [, name, tail] = m;
                if (!/\bimplements\b/.test(tail)) {
                    offenders.push(`${file}: ${name}`);
                }
            }
        }

        expect(offenders, offenders.join('\n')).toEqual([]);
    });
});
