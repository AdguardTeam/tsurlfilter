import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { TsWebExtension } from '../../../../src/lib/mv3/background/app';
import { ContentScriptManager } from '../../../../src/lib/mv3/background/content-script-manager';

vi.mock('../../../../src/lib/common/utils/logger', () => ({
    logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

/**
 * Default namespace used for most tests.
 */
const NS = 'critical';

/**
 * Second namespace used for cross-namespace tests.
 */
const NS2 = 'stealth';

describe('ContentScriptManager', () => {
    /**
     * Tracks registered chrome-level content script IDs to simulate
     * Chrome's real behavior: registerContentScripts rejects if any
     * script ID is already registered or if duplicate IDs appear
     * within a single call.
     */
    let registeredIds: Set<string>;

    const mockRegister = vi.fn();
    const mockUnregister = vi.fn().mockResolvedValue(undefined);
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockGetRegistered = vi.fn();

    /**
     * Snapshot of `global.chrome` before this suite mutates it.
     */
    let originalChrome: typeof global.chrome;

    beforeEach(() => {
        vi.clearAllMocks();
        registeredIds = new Set();

        // Simulate Chrome's real behavior: registerContentScripts rejects
        // if any script ID is already registered or if there are duplicate
        // IDs within a single call.
        mockRegister.mockImplementation((scripts: { id: string }[]) => {
            const ids = scripts.map((s) => s.id);
            // Check for duplicates within the call
            const uniqueIds = new Set(ids);
            if (uniqueIds.size !== ids.length) {
                return Promise.reject(
                    new Error('Duplicate script ID detected within a single call'),
                );
            }
            // Check for already-registered IDs
            const conflicts = ids.filter((id) => registeredIds.has(id));
            if (conflicts.length > 0) {
                return Promise.reject(
                    new Error(`Script IDs already registered: ${conflicts.join(', ')}`),
                );
            }
            // Register all IDs
            ids.forEach((id) => registeredIds.add(id));
            return Promise.resolve(undefined);
        });

        mockUnregister.mockImplementation((opts: { ids: string[] }) => {
            if (opts && opts.ids) {
                opts.ids.forEach((id) => registeredIds.delete(id));
            }
            return Promise.resolve(undefined);
        });

        mockGetRegistered.mockResolvedValue([]);

        // mockUpdateContentScripts: silently update the registered scripts
        mockUpdate.mockImplementation(() => {
            return Promise.resolve(undefined);
        });

        originalChrome = global.chrome;
        global.chrome = {
            ...global.chrome,
            scripting: {
                ...global.chrome.scripting,
                registerContentScripts: mockRegister,
                unregisterContentScripts: mockUnregister,
                updateContentScripts: mockUpdate,
                getRegisteredContentScripts: mockGetRegistered,
            },
        } as any;
    });

    afterEach(() => {
        global.chrome = originalChrome;
    });

    describe('register', () => {
        it('should register scripts with namespace-prefixed IDs', async () => {
            mockGetRegistered.mockResolvedValue([]);
            await ContentScriptManager.register(NS, [{
                id: 'domains',
                js: ['domains.js'],
                matches: ['<all_urls>'],
                runAt: 'document_start',
                persistAcrossSessions: false,
            }]);
            expect(mockRegister).toHaveBeenCalledTimes(1);
            const [scripts] = mockRegister.mock.calls[0];
            expect(scripts).toHaveLength(1);
            expect(scripts[0].id).toBe('critical:domains');
            expect(scripts[0].js).toEqual(['domains.js']);
            expect(scripts[0].runAt).toBe('document_start');
        });

        it('should register multiple scripts with prefixed IDs', async () => {
            mockGetRegistered.mockResolvedValue([]);
            await ContentScriptManager.register(NS, [
                { id: 'gpc', js: ['gpc.js'], matches: ['<all_urls>'] },
                { id: 'docRef', js: ['doc-ref.js'], matches: ['<all_urls>'] },
            ]);
            expect(mockRegister).toHaveBeenCalledTimes(1);
            const [scripts] = mockRegister.mock.calls[0];
            expect(scripts).toHaveLength(2);
            expect(scripts[0].id).toBe('critical:gpc');
            expect(scripts[1].id).toBe('critical:docRef');
        });

        it('should skip already registered scripts', async () => {
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:gpc', js: ['gpc.js'], matches: ['<all_urls>'] },
            ]);
            await ContentScriptManager.register(NS, [
                { id: 'gpc', js: ['gpc-v2.js'], matches: ['<all_urls>'] },
            ]);
            // Should not call register since script already exists
            expect(mockRegister).not.toHaveBeenCalled();
        });

        it('should only register new scripts when some already exist', async () => {
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:existing', js: ['existing.js'], matches: ['<all_urls>'] },
            ]);
            await ContentScriptManager.register(NS, [
                { id: 'existing', js: ['existing.js'], matches: ['<all_urls>'] },
                { id: 'new', js: ['new.js'], matches: ['<all_urls>'] },
            ]);
            expect(mockRegister).toHaveBeenCalledTimes(1);
            const [scripts] = mockRegister.mock.calls[0];
            expect(scripts).toHaveLength(1);
            expect(scripts[0].id).toBe('critical:new');
        });

        it('should handle empty scripts array without chrome calls', async () => {
            await ContentScriptManager.register(NS, []);
            expect(mockRegister).not.toHaveBeenCalled();
            expect(mockGetRegistered).not.toHaveBeenCalled();
        });

        it('should reject when a single call contains duplicate script IDs', async () => {
            // Chrome rejects registerContentScripts when duplicate IDs
            // appear within a single call.
            mockGetRegistered.mockResolvedValue([]);
            await expect(
                ContentScriptManager.register(NS, [
                    { id: 'domains', js: ['first.js'], matches: ['<all_urls>'] },
                    { id: 'domains', js: ['last.js'], matches: ['<all_urls>'] },
                ]),
            ).rejects.toThrow('Duplicate script ID');
        });

        it('should propagate chrome API errors and not modify internal state', async () => {
            mockGetRegistered.mockResolvedValue([]);
            mockRegister.mockRejectedValueOnce(new Error('Invalid match pattern'));
            await expect(
                ContentScriptManager.register(NS, [
                    { id: 'bad', js: ['bad.js'], matches: ['invalid'] },
                ]),
            ).rejects.toThrow('Invalid match pattern');
            expect(mockRegister).toHaveBeenCalledTimes(1);
        });
    });

    describe('unregister', () => {
        it('should unregister scripts by original IDs', async () => {
            await ContentScriptManager.register(NS, [
                { id: 'domains', js: ['domains.js'], matches: ['<all_urls>'] },
                { id: 'tabs', js: ['tabs.js'], matches: ['<all_urls>'] },
            ]);
            vi.clearAllMocks();
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:domains', js: ['domains.js'], matches: ['<all_urls>'] },
                { id: 'critical:tabs', js: ['tabs.js'], matches: ['<all_urls>'] },
            ]);
            await ContentScriptManager.unregister(NS, ['domains']);
            expect(mockUnregister).toHaveBeenCalledTimes(1);
            expect(mockUnregister).toHaveBeenCalledWith({ ids: ['critical:domains'] });
            expect(mockRegister).not.toHaveBeenCalled();
        });

        it('should skip non-existent IDs', async () => {
            mockGetRegistered.mockResolvedValue([]);
            await ContentScriptManager.unregister(NS, ['nonexistent']);
            // Should not call unregister since script doesn't exist
            expect(mockUnregister).not.toHaveBeenCalled();
        });

        it('should only unregister existing scripts when some do not exist', async () => {
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:domains', js: ['domains.js'], matches: ['<all_urls>'] },
            ]);
            await ContentScriptManager.unregister(NS, ['domains', 'nonexistent']);
            expect(mockUnregister).toHaveBeenCalledTimes(1);
            expect(mockUnregister).toHaveBeenCalledWith({ ids: ['critical:domains'] });
        });

        it('should propagate Chrome API errors', async () => {
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:test', js: ['test.js'], matches: ['<all_urls>'] },
            ]);
            mockUnregister.mockRejectedValueOnce(new Error('API error'));
            await expect(
                ContentScriptManager.unregister(NS, ['test']),
            ).rejects.toThrow('API error');
        });

        it('should handle empty array without chrome calls', async () => {
            await ContentScriptManager.unregister(NS, []);
            expect(mockUnregister).not.toHaveBeenCalled();
            expect(mockGetRegistered).not.toHaveBeenCalled();
        });
    });

    describe('clear', () => {
        it('should unregister all scripts in the namespace', async () => {
            await ContentScriptManager.register(NS, [
                { id: 'domains', js: ['domains.js'], matches: ['<all_urls>'] },
                { id: 'tabs', js: ['tabs.js'], matches: ['<all_urls>'] },
            ]);
            vi.clearAllMocks();
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:domains', js: ['domains.js'], matches: ['<all_urls>'] },
                { id: 'critical:tabs', js: ['tabs.js'], matches: ['<all_urls>'] },
            ]);
            await ContentScriptManager.clear(NS);
            expect(mockUnregister).toHaveBeenCalledTimes(1);
            expect(mockUnregister).toHaveBeenCalledWith({
                ids: ['critical:domains', 'critical:tabs'],
            });
        });

        it('should no-op when namespace is empty', async () => {
            await ContentScriptManager.clear(NS);
            expect(mockUnregister).not.toHaveBeenCalled();
        });

        it('should leave namespace empty after clear', async () => {
            await ContentScriptManager.register(NS, [
                { id: 'domains', js: ['domains.js'], matches: ['<all_urls>'] },
            ]);
            vi.clearAllMocks();
            // After clear, the namespace has no scripts. Simulate that state
            // by having getRegisteredContentScripts return empty.
            mockGetRegistered.mockResolvedValue([]);
            await ContentScriptManager.clear(NS);
            expect(mockUnregister).not.toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('should update an existing script via updateContentScripts', async () => {
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:domains', js: ['old.js'], matches: ['<all_urls>'] },
            ]);
            await ContentScriptManager.update(NS, [{
                id: 'domains',
                js: ['new.js'],
                matches: ['<all_urls>'],
            }]);
            expect(mockUpdate).toHaveBeenCalledTimes(1);
            expect(mockUpdate.mock.calls[0][0][0].id).toBe('critical:domains');
            expect(mockUpdate.mock.calls[0][0][0].js).toEqual(['new.js']);
            expect(mockRegister).not.toHaveBeenCalled();
            expect(mockUnregister).not.toHaveBeenCalled();
        });

        it('should update multiple scripts at once', async () => {
            await ContentScriptManager.update(NS, [
                { id: 'a', js: ['a-new.js'], matches: ['<all_urls>'] },
                { id: 'b', js: ['b-new.js'], matches: ['<all_urls>'] },
            ]);
            expect(mockUpdate).toHaveBeenCalledTimes(1);
            expect(mockUpdate.mock.calls[0][0]).toHaveLength(2);
            expect(mockUpdate.mock.calls[0][0][0].id).toBe('critical:a');
            expect(mockUpdate.mock.calls[0][0][1].id).toBe('critical:b');
        });

        it('should propagate errors from updateContentScripts', async () => {
            mockUpdate.mockRejectedValueOnce(new Error('Script not found'));
            await expect(
                ContentScriptManager.update(NS, [{
                    id: 'nonexistent',
                    js: ['nonexistent.js'],
                    matches: ['<all_urls>'],
                }]),
            ).rejects.toThrow('Script not found');
        });

        it('should handle empty scripts array without chrome calls', async () => {
            await ContentScriptManager.update(NS, []);
            expect(mockUpdate).not.toHaveBeenCalled();
        });
    });

    describe('sync', () => {
        it('should register new scripts, unregister stale ones, and update existing', async () => {
            await ContentScriptManager.register(NS, [
                { id: 'old', js: ['old.js'], matches: ['<all_urls>'] },
                { id: 'keep', js: ['keep.js'], matches: ['<all_urls>'] },
            ]);
            vi.clearAllMocks();
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:old', js: ['old.js'], matches: ['<all_urls>'] },
                { id: 'critical:keep', js: ['keep.js'], matches: ['<all_urls>'] },
            ]);
            await ContentScriptManager.sync(NS, [
                { id: 'keep', js: ['keep.js'], matches: ['<all_urls>'] },
                { id: 'new', js: ['new.js'], matches: ['<all_urls>'] },
            ]);
            // 'old' is stale → unregistered
            expect(mockUnregister).toHaveBeenCalledWith({ ids: ['critical:old'] });
            // 'new' is not yet registered → registered
            expect(mockRegister).toHaveBeenCalledTimes(1);
            expect(mockRegister.mock.calls[0][0][0].id).toBe('critical:new');
            // 'keep' exists in both but unchanged → NOT updated
            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('should handle empty desired array (clear)', async () => {
            await ContentScriptManager.register(NS, [
                { id: 'domains', js: ['domains.js'], matches: ['<all_urls>'] },
            ]);
            vi.clearAllMocks();
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:domains', js: ['domains.js'], matches: ['<all_urls>'] },
            ]);
            await ContentScriptManager.sync(NS, []);
            expect(mockUnregister).toHaveBeenCalledWith({ ids: ['critical:domains'] });
            expect(mockRegister).not.toHaveBeenCalled();
        });

        it('should unregister all own scripts then re-register desired', async () => {
            await ContentScriptManager.register(NS, [
                { id: 'domains', js: ['domains.js'], matches: ['<all_urls>'] },
            ]);
            vi.clearAllMocks();
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:domains', js: ['domains.js'], matches: ['<all_urls>'] },
            ]);
            await ContentScriptManager.sync(NS, [
                { id: 'domains', js: ['domains.js'], matches: ['<all_urls>'] },
            ]);
            // Script exists in both sets with identical descriptor → no update needed.
            expect(mockUnregister).not.toHaveBeenCalled();
            expect(mockRegister).not.toHaveBeenCalled();
            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('should not update when only chrome-added defaults differ from an omitted desired field', async () => {
            await ContentScriptManager.register(NS, [
                { id: 'domains', js: ['domains.js'], matches: ['<all_urls>'] },
            ]);
            vi.clearAllMocks();
            // Simulates chrome.scripting.getRegisteredContentScripts() actual
            // behavior: it normalizes and fills in defaults for fields the
            // caller never specified.
            mockGetRegistered.mockResolvedValue([
                {
                    id: 'critical:domains',
                    js: ['domains.js'],
                    matches: ['<all_urls>'],
                    allFrames: false,
                    matchOriginAsFallback: false,
                    excludeMatches: undefined,
                    css: undefined,
                    persistAcrossSessions: true,
                    runAt: 'document_idle',
                    world: 'ISOLATED',
                },
            ]);
            await ContentScriptManager.sync(NS, [
                { id: 'domains', js: ['domains.js'], matches: ['<all_urls>'] },
            ]);
            expect(mockUnregister).not.toHaveBeenCalled();
            expect(mockRegister).not.toHaveBeenCalled();
            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('should update scripts with changed properties via updateContentScripts', async () => {
            await ContentScriptManager.register(NS, [
                { id: 'domains', js: ['old.js'], matches: ['<all_urls>'] },
            ]);
            vi.clearAllMocks();
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:domains', js: ['old.js'], matches: ['<all_urls>'] },
            ]);
            await ContentScriptManager.sync(NS, [
                { id: 'domains', js: ['new.js'], matches: ['<all_urls>'] },
            ]);
            // Script exists in both sets with changed properties → updated.
            expect(mockUnregister).not.toHaveBeenCalled();
            expect(mockRegister).not.toHaveBeenCalled();
            expect(mockUpdate).toHaveBeenCalledTimes(1);
            expect(mockUpdate.mock.calls[0][0][0].js).toEqual(['new.js']);
        });

        it('should detect scripts registered outside the manager', async () => {
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:external', js: ['external.js'], matches: ['<all_urls>'] },
            ]);
            await ContentScriptManager.sync(NS, [
                { id: 'managed', js: ['managed.js'], matches: ['<all_urls>'] },
            ]);
            expect(mockUnregister).toHaveBeenCalledWith({ ids: ['critical:external'] });
            expect(mockRegister).toHaveBeenCalledTimes(1);
        });

        it('should handle composite change: register new, unregister stale, update changed', async () => {
            // Pre-populate: a (unchanged), b (to be removed), c (to be changed)
            await ContentScriptManager.register(NS, [
                { id: 'a', js: ['a.js'], matches: ['<all_urls>'] },
                { id: 'b', js: ['b.js'], matches: ['<all_urls>'] },
                { id: 'c', js: ['c-old.js'], matches: ['<all_urls>'] },
            ]);
            vi.clearAllMocks();
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:a', js: ['a.js'], matches: ['<all_urls>'] },
                { id: 'critical:b', js: ['b.js'], matches: ['<all_urls>'] },
                { id: 'critical:c', js: ['c-old.js'], matches: ['<all_urls>'] },
            ]);
            // Desired: a (unchanged), c (changed js), d (new)
            await ContentScriptManager.sync(NS, [
                { id: 'a', js: ['a.js'], matches: ['<all_urls>'] },
                { id: 'c', js: ['c-new.js'], matches: ['<all_urls>'] },
                { id: 'd', js: ['d.js'], matches: ['<all_urls>'] },
            ]);
            // 'b' not in desired → unregistered
            expect(mockUnregister).toHaveBeenCalledTimes(1);
            expect(mockUnregister).toHaveBeenCalledWith({ ids: ['critical:b'] });
            // 'd' not yet registered → registered
            expect(mockRegister).toHaveBeenCalledTimes(1);
            expect(mockRegister.mock.calls[0][0][0].id).toBe('critical:d');
            // 'a' unchanged → NOT updated; 'c' changed → updated
            expect(mockUpdate).toHaveBeenCalledTimes(1);
            const updateScripts = mockUpdate.mock.calls[0][0];
            expect(updateScripts).toHaveLength(1);
            expect(updateScripts[0].id).toBe('critical:c');
        });
    });

    describe('cross-namespace isolation', () => {
        it('should isolate scripts between namespaces', async () => {
            await ContentScriptManager.register(NS, [
                { id: 'shared', js: ['a.js'], matches: ['<all_urls>'] },
            ]);
            await ContentScriptManager.register(NS2, [
                { id: 'shared', js: ['b.js'], matches: ['<all_urls>'] },
            ]);

            mockGetRegistered.mockResolvedValue([
                { id: 'critical:shared', js: ['a.js'], matches: ['<all_urls>'] },
                { id: 'stealth:shared', js: ['b.js'], matches: ['<all_urls>'] },
            ]);

            // Clearing one namespace should not affect the other
            vi.clearAllMocks();
            await ContentScriptManager.clear(NS2);
            expect(mockUnregister).toHaveBeenCalledTimes(1);
            expect(mockUnregister).toHaveBeenCalledWith({ ids: ['stealth:shared'] });

            // After clearing NS2, only NS scripts remain
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:shared', js: ['a.js'], matches: ['<all_urls>'] },
            ]);
            vi.clearAllMocks();
            await ContentScriptManager.clear(NS);
            expect(mockUnregister).toHaveBeenCalledWith({ ids: ['critical:shared'] });
        });
    });

    describe('namespace validation', () => {
        const script = { id: 'test', js: ['test.js'], matches: ['<all_urls>'] };

        it('should reject empty namespace', async () => {
            await expect(
                ContentScriptManager.register('', [script]),
            ).rejects.toThrow('Namespace must not be empty');
        });

        it('should reject whitespace-only namespace', async () => {
            await expect(
                ContentScriptManager.register('   ', [script]),
            ).rejects.toThrow('Namespace must not be empty');
        });

        it('should reject namespace containing the separator character', async () => {
            await expect(
                ContentScriptManager.register('foo:bar', [script]),
            ).rejects.toThrow('contains forbidden character');
        });

        it('should validate namespace before making any chrome API calls', async () => {
            await expect(
                ContentScriptManager.register('', [script]),
            ).rejects.toThrow('Namespace must not be empty');
            expect(mockRegister).not.toHaveBeenCalled();
            expect(mockUnregister).not.toHaveBeenCalled();
            expect(mockGetRegistered).not.toHaveBeenCalled();
        });

        it('should fail-fast on empty namespace even with empty scripts array', async () => {
            await expect(
                ContentScriptManager.register('', []),
            ).rejects.toThrow('Namespace must not be empty');
        });

        it('should fail-fast on colon-containing namespace even with empty scripts array', async () => {
            await expect(
                ContentScriptManager.register('foo:bar', []),
            ).rejects.toThrow('contains forbidden character');
        });

        it('should fail-fast on empty namespace even with empty script IDs array', async () => {
            await expect(
                ContentScriptManager.unregister('', []),
            ).rejects.toThrow('Namespace must not be empty');
        });

        it('should validate namespace on unregister', async () => {
            await expect(
                ContentScriptManager.unregister('   ', ['test']),
            ).rejects.toThrow('Namespace must not be empty');
        });

        it('should validate namespace on clear', async () => {
            await expect(
                ContentScriptManager.clear('foo:bar'),
            ).rejects.toThrow('contains forbidden character');
        });

        it('should validate namespace on update', async () => {
            await expect(
                ContentScriptManager.update('', [script]),
            ).rejects.toThrow('Namespace must not be empty');
        });

        it('should validate namespace on sync', async () => {
            await expect(
                ContentScriptManager.sync('foo:bar', [script]),
            ).rejects.toThrow('contains forbidden character');
        });
    });

    describe('get error path via clear', () => {
        it('should propagate getRegisteredContentScripts errors through clear()', async () => {
            mockGetRegistered.mockRejectedValueOnce(new Error('Chrome API failure'));
            await expect(
                ContentScriptManager.clear(NS),
            ).rejects.toThrow('Chrome API failure');
            expect(mockGetRegistered).toHaveBeenCalledTimes(1);
        });
    });

    describe('get error path via sync', () => {
        it('should propagate getRegisteredContentScripts errors through sync()', async () => {
            mockGetRegistered.mockRejectedValueOnce(new Error('Chrome API failure'));
            await expect(
                ContentScriptManager.sync(NS, [
                    { id: 'test', js: ['test.js'], matches: ['<all_urls>'] },
                ]),
            ).rejects.toThrow('Chrome API failure');
            expect(mockGetRegistered).toHaveBeenCalledTimes(1);
        });
    });

    describe('TsWebExtension.syncContentScripts', () => {
        it('should delegate to ContentScriptManager.sync()', async () => {
            await TsWebExtension.syncContentScripts(NS, [
                { id: 'test', js: ['test.js'], matches: ['<all_urls>'] },
            ]);
            expect(mockRegister).toHaveBeenCalledTimes(1);
            const [scripts] = mockRegister.mock.calls[0];
            expect(scripts).toHaveLength(1);
            expect(scripts[0].id).toBe('critical:test');
        });

        it('should return rejected results when sync operations fail', async () => {
            // Pre-register a script, then make its update fail.
            // (Register failures are surfaced via syncDetailed's failedScriptIds
            // instead — see the batch failure tests below.)
            await ContentScriptManager.register(NS, [
                { id: 'existing', js: ['old.js'], matches: ['<all_urls>'] },
            ]);
            vi.clearAllMocks();
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:existing', js: ['old.js'], matches: ['<all_urls>'] },
            ]);
            mockUpdate.mockRejectedValue(new Error('Update failed'));
            const result = await TsWebExtension.syncContentScripts(NS, [
                { id: 'existing', js: ['new.js'], matches: ['<all_urls>'] },
            ]);
            expect(result).toHaveLength(1);
        });

        it('should perform diff-based sync: unregister stale and register new', async () => {
            // Pre-register a script directly via ContentScriptManager
            await ContentScriptManager.register(NS, [
                { id: 'old', js: ['old.js'], matches: ['<all_urls>'] },
            ]);
            vi.clearAllMocks();
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:old', js: ['old.js'], matches: ['<all_urls>'] },
            ]);

            await TsWebExtension.syncContentScripts(NS, [
                { id: 'new', js: ['new.js'], matches: ['<all_urls>'] },
            ]);

            expect(mockUnregister).toHaveBeenCalledWith({ ids: ['critical:old'] });
            expect(mockRegister).toHaveBeenCalledTimes(1);
            expect(mockRegister.mock.calls[0][0][0].id).toBe('critical:new');
            expect(mockUpdate).not.toHaveBeenCalled();
        });
    });

    describe('sync edge cases', () => {
        it('should no-op when namespace is empty and desired is empty', async () => {
            mockGetRegistered.mockResolvedValue([]);
            await ContentScriptManager.sync(NS, []);
            expect(mockUnregister).not.toHaveBeenCalled();
            expect(mockRegister).not.toHaveBeenCalled();
            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('should return rejected results when unregister fails', async () => {
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:domains', js: ['domains.js'], matches: ['<all_urls>'] },
            ]);
            mockUnregister.mockRejectedValue(new Error('Unregister API failure'));
            const result = await ContentScriptManager.sync(NS, [
                { id: 'new', js: ['new.js'], matches: ['<all_urls>'] },
            ]);
            expect(result).toHaveLength(1);
            expect(mockUnregister).toHaveBeenCalledTimes(1);
        });

        // eslint-disable-next-line max-len
        it('should report failed IDs and leave namespace empty when unregister succeeds but register fails', async () => {
            // Pre-register one script in the namespace.
            await ContentScriptManager.register(NS, [
                { id: 'old', js: ['old.js'], matches: ['<all_urls>'] },
            ]);
            vi.clearAllMocks();

            // Chrome reports the existing script.
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:old', js: ['old.js'], matches: ['<all_urls>'] },
            ]);

            // Unregister will succeed (removing 'old'); the batch register
            // fails (invalid match pattern for 'new'). Since the batch is
            // atomic, 'new' ends up both in errors and in failedScriptIds.
            mockRegister.mockRejectedValue(new Error('Invalid match pattern'));

            const { errors, failedScriptIds } = await ContentScriptManager.syncDetailed(NS, [
                { id: 'new', js: ['new.js'], matches: ['<invalid>'] },
            ]);

            // syncDetailed() collects errors — it does NOT throw.
            expect(errors).toHaveLength(1);
            expect(failedScriptIds).toEqual(['new']);

            // Verify unregister was called (removing 'old').
            expect(mockUnregister).toHaveBeenCalledWith({ ids: ['critical:old'] });

            // Single batch register attempt.
            expect(mockRegister).toHaveBeenCalledTimes(1);
            expect(mockRegister.mock.calls[0][0][0].id).toBe('critical:new');

            // The namespace is now empty — old script was removed, new script was not added.
            // This is the documented partial-failure behavior: the caller must inspect
            // failedScriptIds and decide how to recover.
        });
    });

    describe('clear error path', () => {
        it('should propagate errors from the unregister step', async () => {
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:a', js: ['a.js'], matches: ['<all_urls>'] },
                { id: 'critical:b', js: ['b.js'], matches: ['<all_urls>'] },
            ]);
            mockUnregister.mockRejectedValueOnce(new Error('Unregister failure'));
            await expect(
                ContentScriptManager.clear(NS),
            ).rejects.toThrow('Unregister failure');
            // clear() calls get(), then unregister() also calls get() to check existence
            expect(mockGetRegistered).toHaveBeenCalledTimes(2);
            expect(mockUnregister).toHaveBeenCalledTimes(1);
            expect(mockUnregister).toHaveBeenCalledWith({
                ids: ['critical:a', 'critical:b'],
            });
        });
    });

    describe('update edge cases', () => {
        it('should not confuse scripts with same original ID in different namespaces', async () => {
            // Register 'shared' in both namespaces
            await ContentScriptManager.register(NS, [
                { id: 'shared', js: ['a.js'], matches: ['<all_urls>'] },
            ]);
            await ContentScriptManager.register(NS2, [
                { id: 'shared', js: ['b.js'], matches: ['<all_urls>'] },
            ]);
            vi.clearAllMocks();

            // Update 'shared' in NS - should only affect 'critical:shared'
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:shared', js: ['a.js'], matches: ['<all_urls>'] },
                { id: 'stealth:shared', js: ['b.js'], matches: ['<all_urls>'] },
            ]);

            await ContentScriptManager.update(NS, [{
                id: 'shared',
                js: ['c.js'],
                matches: ['<all_urls>'],
            }]);

            // Only the NS script should be updated
            expect(mockUpdate).toHaveBeenCalledTimes(1);
            const [updateScripts] = mockUpdate.mock.calls[0];
            expect(updateScripts).toHaveLength(1);
            expect(updateScripts[0].id).toBe('critical:shared');

            // The other namespace's script should still exist
            expect(registeredIds.has('stealth:shared')).toBe(true);
        });
    });

    describe('upsert', () => {
        it('should register scripts that do not exist yet', async () => {
            mockGetRegistered.mockResolvedValue([]);
            await ContentScriptManager.upsert(NS, [
                { id: 'new', js: ['new.js'], matches: ['<all_urls>'] },
            ]);
            expect(mockRegister).toHaveBeenCalledTimes(1);
            expect(mockRegister.mock.calls[0][0][0].id).toBe('critical:new');
            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('should update scripts that already exist', async () => {
            await ContentScriptManager.register(NS, [
                { id: 'existing', js: ['old.js'], matches: ['<all_urls>'] },
            ]);
            vi.clearAllMocks();
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:existing', js: ['old.js'], matches: ['<all_urls>'] },
            ]);
            await ContentScriptManager.upsert(NS, [
                { id: 'existing', js: ['new.js'], matches: ['<all_urls>'] },
            ]);
            expect(mockUpdate).toHaveBeenCalledTimes(1);
            expect(mockUpdate.mock.calls[0][0][0].id).toBe('critical:existing');
            expect(mockUpdate.mock.calls[0][0][0].js).toEqual(['new.js']);
            expect(mockRegister).not.toHaveBeenCalled();
        });

        it('should handle mixed scenario with both new and existing scripts', async () => {
            await ContentScriptManager.register(NS, [
                { id: 'keep', js: ['keep.js'], matches: ['<all_urls>'] },
            ]);
            vi.clearAllMocks();
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:keep', js: ['keep.js'], matches: ['<all_urls>'] },
            ]);
            await ContentScriptManager.upsert(NS, [
                { id: 'keep', js: ['keep-updated.js'], matches: ['<all_urls>'] },
                { id: 'new', js: ['new.js'], matches: ['<all_urls>'] },
            ]);
            // 'keep' exists → updated
            expect(mockUpdate).toHaveBeenCalledTimes(1);
            expect(mockUpdate.mock.calls[0][0][0].id).toBe('critical:keep');
            expect(mockUpdate.mock.calls[0][0][0].js).toEqual(['keep-updated.js']);
            // 'new' does not exist → registered
            expect(mockRegister).toHaveBeenCalledTimes(1);
            expect(mockRegister.mock.calls[0][0][0].id).toBe('critical:new');
        });

        it('should handle empty scripts array without chrome calls', async () => {
            const result = await ContentScriptManager.upsert(NS, []);
            expect(mockRegister).not.toHaveBeenCalled();
            expect(mockUpdate).not.toHaveBeenCalled();
            expect(mockGetRegistered).not.toHaveBeenCalled();
            expect(result).toEqual([]);
        });

        it('should return empty array when all operations succeed', async () => {
            mockGetRegistered.mockResolvedValue([]);
            const result = await ContentScriptManager.upsert(NS, [
                { id: 'test', js: ['test.js'], matches: ['<all_urls>'] },
            ]);
            expect(result).toEqual([]);
        });

        it('should return rejected results when register fails', async () => {
            mockGetRegistered.mockResolvedValue([]);
            mockRegister.mockRejectedValueOnce(new Error('Invalid match pattern'));
            const result = await ContentScriptManager.upsert(NS, [
                { id: 'bad', js: ['bad.js'], matches: ['<invalid>'] },
            ]);
            expect(result).toHaveLength(1);
            expect(result[0].status).toBe('rejected');
            expect((result[0] as PromiseRejectedResult).reason).toBeInstanceOf(Error);
            expect((result[0] as PromiseRejectedResult).reason.message).toBe('Invalid match pattern');
        });

        it('should return rejected results when update fails', async () => {
            await ContentScriptManager.register(NS, [
                { id: 'existing', js: ['old.js'], matches: ['<all_urls>'] },
            ]);
            vi.clearAllMocks();
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:existing', js: ['old.js'], matches: ['<all_urls>'] },
            ]);
            mockUpdate.mockRejectedValueOnce(new Error('Update API failure'));
            const result = await ContentScriptManager.upsert(NS, [
                { id: 'existing', js: ['new.js'], matches: ['<all_urls>'] },
            ]);
            expect(result).toHaveLength(1);
            expect(result[0].status).toBe('rejected');
            expect((result[0] as PromiseRejectedResult).reason.message).toBe('Update API failure');
        });

        it('should collect multiple errors from partial failures', async () => {
            await ContentScriptManager.register(NS, [
                { id: 'existing', js: ['old.js'], matches: ['<all_urls>'] },
            ]);
            vi.clearAllMocks();
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:existing', js: ['old.js'], matches: ['<all_urls>'] },
            ]);
            mockRegister.mockRejectedValueOnce(new Error('Register failed'));
            mockUpdate.mockRejectedValueOnce(new Error('Update failed'));
            const result = await ContentScriptManager.upsert(NS, [
                { id: 'existing', js: ['new.js'], matches: ['<all_urls>'] },
                { id: 'new', js: ['new.js'], matches: ['<all_urls>'] },
            ]);
            expect(result).toHaveLength(2);
            expect(result[0].status).toBe('rejected');
            expect(result[1].status).toBe('rejected');
        });

        it('should validate namespace before making any chrome API calls', async () => {
            await expect(
                ContentScriptManager.upsert('', [
                    { id: 'test', js: ['test.js'], matches: ['<all_urls>'] },
                ]),
            ).rejects.toThrow('Namespace must not be empty');
            expect(mockRegister).not.toHaveBeenCalled();
            expect(mockUpdate).not.toHaveBeenCalled();
            expect(mockGetRegistered).not.toHaveBeenCalled();
        });

        it('should validate namespace with colon character', async () => {
            await expect(
                ContentScriptManager.upsert('foo:bar', [
                    { id: 'test', js: ['test.js'], matches: ['<all_urls>'] },
                ]),
            ).rejects.toThrow('contains forbidden character');
        });

        it('should not confuse scripts with same original ID in different namespaces', async () => {
            // Register 'shared' in both namespaces
            await ContentScriptManager.register(NS, [
                { id: 'shared', js: ['a.js'], matches: ['<all_urls>'] },
            ]);
            await ContentScriptManager.register(NS2, [
                { id: 'shared', js: ['b.js'], matches: ['<all_urls>'] },
            ]);
            vi.clearAllMocks();

            // Upsert 'shared' in NS - should only affect 'critical:shared'
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:shared', js: ['a.js'], matches: ['<all_urls>'] },
                { id: 'stealth:shared', js: ['b.js'], matches: ['<all_urls>'] },
            ]);

            await ContentScriptManager.upsert(NS, [{
                id: 'shared',
                js: ['c.js'],
                matches: ['<all_urls>'],
            }]);

            // Only the NS script should be updated
            expect(mockUpdate).toHaveBeenCalledTimes(1);
            const [updateScripts] = mockUpdate.mock.calls[0];
            expect(updateScripts).toHaveLength(1);
            expect(updateScripts[0].id).toBe('critical:shared');
            expect(updateScripts[0].js).toEqual(['c.js']);

            // The other namespace's script should not be affected
            expect(mockRegister).not.toHaveBeenCalled();
        });

        it('should propagate getRegisteredContentScripts errors', async () => {
            mockGetRegistered.mockRejectedValueOnce(new Error('Chrome API failure'));
            await expect(
                ContentScriptManager.upsert(NS, [
                    { id: 'test', js: ['test.js'], matches: ['<all_urls>'] },
                ]),
            ).rejects.toThrow('Chrome API failure');
            expect(mockGetRegistered).toHaveBeenCalledTimes(1);
        });

        it('should handle multiple new scripts in single call', async () => {
            mockGetRegistered.mockResolvedValue([]);
            await ContentScriptManager.upsert(NS, [
                { id: 'a', js: ['a.js'], matches: ['<all_urls>'] },
                { id: 'b', js: ['b.js'], matches: ['<all_urls>'] },
                { id: 'c', js: ['c.js'], matches: ['<all_urls>'] },
            ]);
            expect(mockRegister).toHaveBeenCalledTimes(1);
            const [scripts] = mockRegister.mock.calls[0];
            expect(scripts).toHaveLength(3);
            expect(scripts.map((s: { id: string }) => s.id)).toEqual([
                'critical:a',
                'critical:b',
                'critical:c',
            ]);
            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('should handle multiple existing scripts in single call', async () => {
            await ContentScriptManager.register(NS, [
                { id: 'a', js: ['a-old.js'], matches: ['<all_urls>'] },
                { id: 'b', js: ['b-old.js'], matches: ['<all_urls>'] },
            ]);
            vi.clearAllMocks();
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:a', js: ['a-old.js'], matches: ['<all_urls>'] },
                { id: 'critical:b', js: ['b-old.js'], matches: ['<all_urls>'] },
            ]);
            await ContentScriptManager.upsert(NS, [
                { id: 'a', js: ['a-new.js'], matches: ['<all_urls>'] },
                { id: 'b', js: ['b-new.js'], matches: ['<all_urls>'] },
            ]);
            expect(mockUpdate).toHaveBeenCalledTimes(1);
            const [scripts] = mockUpdate.mock.calls[0];
            expect(scripts).toHaveLength(2);
            expect(scripts.map((s: { id: string }) => s.id)).toEqual([
                'critical:a',
                'critical:b',
            ]);
            expect(mockRegister).not.toHaveBeenCalled();
        });
    });

    describe('listIds', () => {
        it('should return original (unprefixed) IDs of registered scripts', async () => {
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:a', js: ['a.js'], matches: ['<all_urls>'] },
                { id: 'critical:b', js: ['b.js'], matches: ['<all_urls>'] },
                { id: 'stealth:c', js: ['c.js'], matches: ['<all_urls>'] },
            ]);

            const ids = await ContentScriptManager.listIds(NS);

            expect(ids.sort()).toEqual(['a', 'b']);
        });

        it('should return an empty array when nothing is registered', async () => {
            mockGetRegistered.mockResolvedValue([]);

            const ids = await ContentScriptManager.listIds(NS);

            expect(ids).toEqual([]);
        });

        it('should validate namespace before making any chrome API calls', async () => {
            await expect(ContentScriptManager.listIds('')).rejects.toThrow('Namespace must not be empty');
            expect(mockGetRegistered).not.toHaveBeenCalled();
        });
    });

    describe('syncDetailed — batch failures', () => {
        it('should report all new IDs as failed when the batch register fails because of one bad entry', async () => {
            mockGetRegistered.mockResolvedValue([]);
            mockRegister.mockRejectedValue(new Error('Invalid match pattern'));

            const { errors, failedScriptIds } = await ContentScriptManager.syncDetailed(NS, [
                { id: 'good', js: ['good.js'], matches: ['<all_urls>'] },
                { id: 'bad', js: ['bad.js'], matches: ['<invalid>'] },
            ]);

            // The batch register is atomic — nothing was registered, so ALL
            // new IDs are reported as failed; the caller is expected to fall
            // back for them.
            expect(errors).toHaveLength(1);
            expect(failedScriptIds.sort()).toEqual(['bad', 'good']);
            expect(mockRegister).toHaveBeenCalledTimes(1);
        });

        it('should surface an error and leave the stale registration when a batch update fails', async () => {
            await ContentScriptManager.register(NS, [
                { id: 'existing', js: ['old.js'], matches: ['<all_urls>'] },
            ]);
            vi.clearAllMocks();
            mockGetRegistered.mockResolvedValue([
                { id: 'critical:existing', js: ['old.js'], matches: ['<all_urls>'] },
            ]);
            mockUpdate.mockRejectedValue(new Error('Update API failure'));

            const { errors, failedScriptIds } = await ContentScriptManager.syncDetailed(NS, [
                { id: 'existing', js: ['new.js'], matches: ['<all_urls>'] },
            ]);

            expect(errors).toHaveLength(1);
            // Stale registration is still active — not reported as failed.
            expect(failedScriptIds).toEqual([]);
        });

        it('should report all desired IDs as failed when every registration fails', async () => {
            mockGetRegistered.mockResolvedValue([]);
            mockRegister.mockRejectedValue(new Error('Register API failure'));

            const { errors, failedScriptIds } = await ContentScriptManager.syncDetailed(NS, [
                { id: 'a', js: ['a.js'], matches: ['<all_urls>'] },
                { id: 'b', js: ['b.js'], matches: ['<all_urls>'] },
            ]);

            expect(errors).toHaveLength(1);
            expect(failedScriptIds.sort()).toEqual(['a', 'b']);
        });
    });
});
