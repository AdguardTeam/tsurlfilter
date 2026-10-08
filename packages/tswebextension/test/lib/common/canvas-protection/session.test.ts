import { webcrypto } from 'node:crypto';

import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { CanvasProtectionSession } from '../../../../src/lib/common/canvas-protection/session';

describe('Protection session', () => {
    beforeEach(() => {
        vi.stubGlobal('crypto', webcrypto);
    });

    it('creates independent 16-byte hex values', () => {
        const first = CanvasProtectionSession.create();
        const second = CanvasProtectionSession.create();
        const values = [first.root, first.generation, second.root, second.generation];
        values.forEach((value) => expect(value).toMatch(/^[0-9a-f]{32}$/));
        expect(new Set(values).size).toBe(values.length);
    });
});
