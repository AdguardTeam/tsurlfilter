import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

const fixture = vi.hoisted(() => {
    const values = new Map<string, string>();
    const session = {
        get: vi.fn(async (key: string) => {
            const value = values.get(key);
            return value === undefined ? {} : { [key]: JSON.parse(value) };
        }),
        set: vi.fn(async (data: Record<string, unknown>) => {
            Object.entries(data).forEach(([key, value]) => values.set(key, JSON.stringify(value)));
        }),
        remove: vi.fn(async (keys: string | string[]) => {
            (Array.isArray(keys) ? keys : [keys]).forEach((key) => values.delete(key));
        }),
    };
    return { values, session, browser: { storage: { session } } };
});

vi.mock('webextension-polyfill', () => ({ default: fixture.browser }));

const SESSION_KEY = 'tswebextension.canvasProtectionSession';

describe('Protection session', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        fixture.values.clear();
        fixture.browser.storage.session = fixture.session;
        chrome.storage.session = {
            setAccessLevel: vi.fn().mockResolvedValue(undefined),
        } as unknown as typeof chrome.storage.session;
    });

    it('creates one stored root for concurrent initialization', async () => {
        const { getProtectionSession } = await import('../../../../src/lib/common/canvas-protection/session');
        const random = vi.spyOn(crypto, 'getRandomValues');
        const results = await Promise.all(Array.from({ length: 20 }, () => getProtectionSession()));
        expect(results.every((result) => result.status === 'available')).toBe(true);
        expect(results).toEqual(Array.from({ length: 20 }, () => results[0]));
        expect(fixture.session.set).toHaveBeenCalledOnce();
        expect(random).toHaveBeenCalledTimes(2);
        const stored = JSON.parse(fixture.values.get(SESSION_KEY)!);
        expect(stored.root).toMatch(/^[a-f\d]{32}$/);
        expect(stored.generation).toMatch(/^[a-f\d]{32}$/);
        expect(stored.root).not.toBe(stored.generation);
        expect(random.mock.calls.every(([bytes]) => bytes?.byteLength === 16)).toBe(true);
        expect(chrome.storage.session.setAccessLevel).toHaveBeenCalledWith({ accessLevel: 'TRUSTED_CONTEXTS' });
        random.mockRestore();
    });

    it('reuses stored generation after a non-reset module restart', async () => {
        const first = await import('../../../../src/lib/common/canvas-protection/session');
        const initial = await first.getProtectionSession();
        vi.resetModules();
        const restarted = await import('../../../../src/lib/common/canvas-protection/session');
        expect(await restarted.getProtectionSession()).toEqual(initial);
        expect(fixture.session.set).toHaveBeenCalledOnce();
    });

    it('reports missing session storage without using memory storage', async () => {
        fixture.browser.storage.session = undefined as unknown as typeof fixture.session;
        const { getProtectionSession } = await import('../../../../src/lib/common/canvas-protection/session');
        await expect(getProtectionSession()).resolves.toMatchObject({
            status: 'unavailable', reason: expect.stringContaining('storage.session'),
        });
        expect(fixture.session.set).not.toHaveBeenCalled();
    });

    it('works without the Chromium access-level API', async () => {
        chrome.storage.session = undefined as unknown as typeof chrome.storage.session;
        const { getProtectionSession } = await import('../../../../src/lib/common/canvas-protection/session');
        await expect(getProtectionSession()).resolves.toMatchObject({ status: 'available' });
    });

    it('propagates unreadable trusted storage without minting a replacement', async () => {
        fixture.values.set(SESSION_KEY, '{');
        const { getProtectionSession } = await import('../../../../src/lib/common/canvas-protection/session');
        await expect(getProtectionSession()).rejects.toBeInstanceOf(SyntaxError);
        expect(fixture.session.set).not.toHaveBeenCalled();
        expect(fixture.values.get(SESSION_KEY)).toBe('{');
    });

    it('propagates failed storage writes and permits a later retry', async () => {
        const { getProtectionSession } = await import('../../../../src/lib/common/canvas-protection/session');
        fixture.session.set.mockRejectedValueOnce(new Error('storage write rejected'));
        await expect(getProtectionSession()).rejects.toThrow('storage write rejected');
        expect(fixture.values.has(SESSION_KEY)).toBe(false);
        await expect(getProtectionSession()).resolves.toMatchObject({ status: 'available' });
        expect(fixture.values.has(SESSION_KEY)).toBe(true);
    });

    it('creates a new root and generation after the browser clears session storage', async () => {
        const { getProtectionSession } = await import('../../../../src/lib/common/canvas-protection/session');
        const previous = await getProtectionSession();
        fixture.values.clear();
        const current = await getProtectionSession();
        expect(current.status).toBe('available');
        expect(current).not.toEqual(previous);
    });
});
