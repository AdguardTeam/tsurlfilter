import { webcrypto } from 'node:crypto';

import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    type CanvasBootstrapSnapshot,
    type CanvasFeatureGates,
    type RegistrationOperationOutcome,
} from '../../../../src/lib/common/canvas-protection/contracts';
import {
    CanvasProtectionRegistration,
    type CanvasRegistrationAdapter,
    CanvasRegistrationOperationError,
} from '../../../../src/lib/common/canvas-protection/registration';
import { getProtectionSession } from '../../../../src/lib/common/canvas-protection/session';
import { ChromiumCanvasRegistration } from '../../../../src/lib/mv3/background/canvas-registration';

import { createProtectAllPolicy } from './fixtures/prepared-policies';

const fixture = vi.hoisted(() => {
    /**
     * Creates an independent browser storage area with serialized own values.
     *
     * @returns Storage methods and saved serialized data.
     */
    const createArea = (): {
        values: Map<string, string>;
        get: ReturnType<typeof vi.fn>;
        set: ReturnType<typeof vi.fn>;
        remove: ReturnType<typeof vi.fn>;
    } => {
        const values = new Map<string, string>();
        return {
            values,
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
    };
    const local = createArea();
    const session = createArea();
    const sync = createArea();
    return {
        local, session, sync, browser: { storage: { local, session, sync } },
    };
});

vi.mock('webextension-polyfill', () => ({ default: fixture.browser }));

const REQUEST_KEY = 'tswebextension.canvasProtectionRequested';
const SESSION_KEY = 'tswebextension.canvasProtectionSession';
const SNAPSHOT_KEY = 'tswebextension.canvasProtectionRequestedSnapshot';
const REGISTRATION_KEY = 'tswebextension.canvasProtectionRegistration';
const enabled: CanvasFeatureGates = { filteringEnabled: true, stealthModeEnabled: true, protectCanvas: true };
const disabled: CanvasFeatureGates = { ...enabled, protectCanvas: false };
const succeeded: readonly RegistrationOperationOutcome[] = [{ operation: 'register', status: 'succeeded' }];

/**
 * Builds a snapshot using the current profile root and a prepared test policy.
 *
 * @param revision Requested policy revision.
 * @param gates Requested feature gates.
 *
 * @returns A trusted caller snapshot.
 */
const snapshot = async (revision = 'policy-a', gates = enabled): Promise<CanvasBootstrapSnapshot> => {
    const session = await getProtectionSession();
    if (session.status !== 'available') {
        throw new Error(session.reason);
    }
    return { session: session.value, gates, policy: createProtectAllPolicy('chromium-mv3', revision) };
};

describe('Canvas protection registration', () => {
    let adapter: CanvasRegistrationAdapter;
    let createCode: ReturnType<typeof vi.fn<(value: CanvasBootstrapSnapshot) => string>>;
    let manager: CanvasProtectionRegistration;

    beforeEach(async () => {
        vi.stubGlobal('crypto', webcrypto);
        vi.clearAllMocks();
        fixture.local.values.clear();
        fixture.session.values.clear();
        fixture.sync.values.clear();
        fixture.browser.storage.session = fixture.session;
        Reflect.set(fixture.browser.storage, 'local', fixture.local);
        chrome.storage.session = {
            setAccessLevel: vi.fn().mockResolvedValue(undefined),
        } as unknown as typeof chrome.storage.session;
        fixture.session.values.clear();
        adapter = {
            checkAvailability: vi.fn().mockResolvedValue({ status: 'available', value: false }),
            install: vi.fn().mockResolvedValue(succeeded),
            remove: vi.fn().mockResolvedValue([{ operation: 'unregister', status: 'succeeded' }]),
        };
        createCode = vi.fn((value: CanvasBootstrapSnapshot) => JSON.stringify(value));
        manager = new CanvasProtectionRegistration(adapter, createCode);
    });

    it('does not require local storage when canvas protection was never requested', async () => {
        Reflect.deleteProperty(fixture.browser.storage, 'local');
        expect((await manager.reconcile()).status).toBe('disabled');
        expect((await manager.apply({ gates: disabled })).status).toBe('disabled');
        expect((await manager.disable(disabled)).status).toBe('disabled');
        expect(adapter.checkAvailability).not.toHaveBeenCalled();
        expect((await manager.apply({
            gates: enabled, policy: createProtectAllPolicy('chromium-mv3', 'storage-unavailable'),
        })))
            .toMatchObject({ status: 'unavailable', reason: expect.stringContaining('storage.local') });
        expect(adapter.install).not.toHaveBeenCalled();
    });

    it('skips repeated browser writes only for the same acknowledged code and generation', async () => {
        const request = await snapshot();
        await manager.apply(request);
        vi.mocked(adapter.checkAvailability).mockResolvedValue({ status: 'available', value: true });
        expect((await manager.apply(request)).status).toBe('installed');
        const restarted = new CanvasProtectionRegistration(adapter, createCode);
        expect((await restarted.reconcile()).status).toBe('installed');
        expect(adapter.install).toHaveBeenCalledOnce();
        const changed = {
            ...request,
            policy: {
                ...request.policy,
                selectors: { matches: ['https://changed.example/*'], excludeMatches: [] },
            },
        };
        await restarted.apply(changed);
        expect(adapter.install).toHaveBeenCalledTimes(2);
        fixture.session.values.clear();
        await restarted.reconcile();
        expect(adapter.install).toHaveBeenCalledTimes(3);
    });

    it('persists the seed-free request before checking API availability', async () => {
        const value = await snapshot();
        vi.mocked(adapter.checkAvailability).mockImplementationOnce(async () => {
            expect(JSON.parse(fixture.local.values.get(REQUEST_KEY)!)).toEqual({
                gates: enabled, policy: value.policy,
            });
            return { status: 'unavailable', reason: 'Allow User Scripts disabled' };
        });
        const result = await manager.apply(value);
        expect(result).toMatchObject({ status: 'unavailable', requested: { gates: enabled, revision: 'policy-a' } });
        expect(result.requiredUserAction).toBeTruthy();
        expect(adapter.install).not.toHaveBeenCalled();
        expect(manager.getState()).toEqual(result);
    });

    it('acknowledges only after fulfilled installation and regenerates delivery code', async () => {
        const value = await snapshot();
        let acknowledge!: () => void;
        const blocked = new Promise<void>((resolve) => { acknowledge = resolve; });
        vi.mocked(adapter.install).mockImplementationOnce(async (code, policy) => {
            expect(code).toBe(createCode.mock.results[0].value);
            expect(policy).toEqual(value.policy);
            expect(createCode).toHaveBeenLastCalledWith(value);
            expect(manager.getState().status).not.toBe('installed');
            expect(fixture.session.values.has(REGISTRATION_KEY)).toBe(false);
            await blocked;
            return succeeded;
        });
        const request = manager.apply(value);
        await vi.waitFor(() => expect(adapter.install).toHaveBeenCalledOnce());
        expect(manager.getState().status).not.toBe('installed');
        acknowledge();
        const result = await request;
        expect(result).toMatchObject({
            status: 'installed',
            installed: { status: 'available', value: { revision: 'policy-a', generation: value.session.generation } },
            operations: [{ operation: 'check', status: 'succeeded' }, ...succeeded],
        });
        expect(JSON.parse(fixture.session.values.get(REGISTRATION_KEY)!)).toMatchObject({
            revision: value.policy.revision, generation: value.session.generation,
        });
    });

    it('serializes register update remove and reports partial failure', async () => {
        const first = await snapshot('policy-a');
        const second = await snapshot('policy-b');
        const events: string[] = [];
        let release!: () => void;
        const blocked = new Promise<void>((resolve) => { release = resolve; });
        vi.mocked(adapter.install).mockImplementationOnce(async () => {
            events.push('register-start');
            await blocked;
            events.push('register-finish');
            return succeeded;
        }).mockImplementationOnce(async () => {
            events.push('update');
            throw new CanvasRegistrationOperationError('retirement rejected', [
                { operation: 'register', status: 'succeeded' },
                { operation: 'unregister', status: 'failed', reason: 'old handle rejected' },
            ]);
        });
        vi.mocked(adapter.checkAvailability).mockResolvedValue({ status: 'available', value: true });
        vi.mocked(adapter.remove).mockImplementationOnce(async () => {
            events.push('remove');
            return [{ operation: 'unregister', status: 'succeeded' }];
        });
        const install = manager.apply(first);
        const update = manager.apply(second);
        const removal = manager.disable(disabled);
        await vi.waitFor(() => expect(events).toEqual(['register-start']));
        release();
        const initial = await install;
        const partial = await update;
        const removed = await removal;
        expect(events).toEqual(['register-start', 'register-finish', 'update', 'remove']);
        expect(initial.status).toBe('installed');
        expect(partial).toMatchObject({ status: 'failed', installed: initial.installed });
        expect(partial.operations).toEqual([
            { operation: 'check', status: 'succeeded' },
            { operation: 'register', status: 'succeeded' },
            { operation: 'unregister', status: 'failed', reason: 'old handle rejected' },
        ]);
        expect(removed.status).toBe('disabled');
        expect(manager.getState()).toEqual(removed);
        expect(JSON.parse(fixture.local.values.get(REQUEST_KEY)!).gates).toEqual(disabled);
    });

    it('reconciles the latest requested disable after access restoration', async () => {
        const initial = await manager.apply(await snapshot());
        vi.mocked(adapter.checkAvailability).mockResolvedValue({ status: 'unavailable', reason: 'access revoked' });
        const pending = await manager.disable(disabled);
        expect(pending).toMatchObject({ status: 'unavailable', installed: initial.installed });
        expect(JSON.parse(fixture.local.values.get(REQUEST_KEY)!).gates).toEqual(disabled);
        expect(adapter.remove).not.toHaveBeenCalled();
        vi.mocked(adapter.checkAvailability).mockResolvedValue({ status: 'available', value: true });
        expect(manager.getState().status).toBe('unavailable');
        const reconciled = await manager.reconcile();
        expect(reconciled.status).toBe('disabled');
        expect(adapter.remove).toHaveBeenCalledOnce();
        expect(reconciled.installed.status).toBe('unavailable');
    });

    it('stops claiming current success immediately when reconciliation is requested', async () => {
        await manager.apply(await snapshot());
        expect(manager.getState().status).toBe('installed');
        const retry = manager.reconcile();
        expect(manager.getState().status).not.toBe('installed');
        await retry;
        expect(manager.getState().status).toBe('installed');
    });

    it('keeps the latest overlapping request pending when an earlier installation succeeds', async () => {
        const first = await snapshot('policy-first');
        const latest = await snapshot('policy-latest');
        let acknowledgeFirst!: () => void;
        let acknowledgeLatest!: () => void;
        const firstBlocked = new Promise<void>((resolve) => { acknowledgeFirst = resolve; });
        const latestBlocked = new Promise<void>((resolve) => { acknowledgeLatest = resolve; });
        vi.mocked(adapter.install).mockImplementationOnce(async () => {
            await firstBlocked;
            return succeeded;
        }).mockImplementationOnce(async () => {
            await latestBlocked;
            return [{ operation: 'update', status: 'succeeded' }];
        });
        const firstRequest = manager.apply(first);
        await vi.waitFor(() => expect(adapter.install).toHaveBeenCalledOnce());
        const latestRequest = manager.apply(latest);
        expect(manager.getState().requested.revision).toBe('policy-latest');
        expect(manager.getState().status).not.toBe('installed');
        acknowledgeFirst();
        const earlier = await firstRequest;
        expect(earlier.status).toBe('installed');
        expect(manager.getState().requested.revision).toBe('policy-latest');
        expect(manager.getState().status).not.toBe('installed');
        await vi.waitFor(() => expect(adapter.install).toHaveBeenCalledTimes(2));
        acknowledgeLatest();
        expect((await latestRequest).status).toBe('installed');
        expect(manager.getState().requested.revision).toBe('policy-latest');
    });

    it('rehydrates the latest exclusion request on worker startup and preserves the root after failure', async () => {
        const original = await snapshot();
        await manager.apply(original);
        vi.mocked(adapter.checkAvailability).mockResolvedValue({ status: 'unavailable', reason: 'access revoked' });
        const candidate = await snapshot('policy-excluded');
        const replacement: CanvasBootstrapSnapshot = {
            ...candidate,
            policy: {
                ...candidate.policy,
                selectors: { ...candidate.policy.selectors, excludeMatches: ['https://excluded.example/*'] },
            },
        };
        await manager.apply(replacement);
        const restarted = new CanvasProtectionRegistration(adapter, createCode);
        vi.mocked(adapter.checkAvailability).mockResolvedValue({ status: 'available', value: true });
        vi.mocked(adapter.install).mockRejectedValueOnce(new CanvasRegistrationOperationError('update rejected', [
            { operation: 'update', status: 'failed', reason: 'update rejected' },
        ]));
        const failed = await restarted.reconcile();
        expect(failed).toMatchObject({
            status: 'failed',
            requested: { revision: 'policy-excluded' },
            installed: { status: 'available', value: { revision: 'policy-a' } },
        });
        const retry = await restarted.reconcile();
        expect(retry).toMatchObject({
            status: 'installed',
            installed: {
                status: 'available',
                value: {
                    revision: 'policy-excluded', generation: original.session.generation,
                },
            },
        });
        expect(createCode.mock.calls.at(-1)?.[0]).toEqual(replacement);
    });

    it('invalidates historical installation after lifecycle registration loss', async () => {
        const original = await snapshot();
        await manager.apply(original);
        const restarted = new CanvasProtectionRegistration(adapter, createCode);
        let reject!: () => void;
        const blocked = new Promise<void>((resolve) => { reject = resolve; });
        vi.mocked(adapter.install).mockImplementationOnce(async () => {
            await blocked;
            throw new CanvasRegistrationOperationError('reinstall rejected', [
                { operation: 'register', status: 'failed', reason: 'reinstall rejected' },
            ]);
        });
        const retry = restarted.reconcile();
        await vi.waitFor(() => expect(adapter.install).toHaveBeenCalledTimes(2));
        expect(restarted.getState().status).not.toBe('installed');
        expect(restarted.getState().installed.status).toBe('unavailable');
        expect(fixture.session.values.has(REGISTRATION_KEY)).toBe(false);
        reject();
        expect(await retry).toMatchObject({ status: 'failed', installed: { status: 'unavailable' } });
        expect((await restarted.reconcile()).status).toBe('installed');
        expect(createCode.mock.calls.at(-1)?.[0].session).toEqual(original.session);
    });

    it('keeps current generation separate from captured startup generation', async () => {
        const original = await snapshot();
        await manager.apply(original);
        fixture.session.values.delete(SESSION_KEY);
        const current = await snapshot('policy-next');
        expect(current.session).not.toEqual(original.session);
        vi.mocked(adapter.checkAvailability).mockResolvedValue({ status: 'available', value: true });
        vi.mocked(adapter.install).mockRejectedValueOnce(new CanvasRegistrationOperationError('update rejected', [
            { operation: 'update', status: 'failed', reason: 'update rejected' },
        ]));
        const failed = await manager.apply(current);
        expect(failed.installed).toEqual({
            status: 'available',
            value: {
                revision: original.policy.revision, generation: original.session.generation,
            },
        });
        expect((await manager.reconcile()).installed).toEqual({
            status: 'available',
            value: {
                revision: current.policy.revision, generation: current.session.generation,
            },
        });
        expect(original.session).not.toEqual(current.session);
    });

    it('keeps roots in session storage and rehydrates seed-free requests after native reset', async () => {
        const original = await snapshot();
        await manager.apply(original);
        const requested = JSON.parse(fixture.local.values.get(REQUEST_KEY)!);
        expect(requested).toEqual({ gates: enabled, policy: original.policy });
        expect(fixture.local.values.size).toBe(1);
        expect(fixture.sync.values.size).toBe(0);
        fixture.session.values.clear();
        expect(fixture.session.values.size).toBe(0);
        expect(JSON.parse(fixture.local.values.get(REQUEST_KEY)!)).toEqual(requested);
        const restarted = new CanvasProtectionRegistration(adapter, createCode);
        const result = await restarted.reconcile();
        expect(result.status).toBe('installed');
        const rehydrated = createCode.mock.calls.at(-1)![0];
        expect(rehydrated.session).not.toEqual(original.session);
        expect(rehydrated.gates).toEqual(enabled);
        expect(rehydrated.policy).toEqual(original.policy);
        expect(vi.mocked(adapter.install).mock.calls.at(-1)![0]).toBe(createCode.mock.results.at(-1)!.value);
        expect(createCode).toHaveBeenLastCalledWith(rehydrated);
        expect(fixture.local.values.size).toBe(1);
        expect(fixture.sync.set).not.toHaveBeenCalled();
    });

    it('uses the current stored root when apply receives a stale caller snapshot after reset', async () => {
        const original = await snapshot();
        await manager.apply(original);
        fixture.session.values.clear();
        const current = await getProtectionSession();
        await manager.apply(original);
        expect(createCode.mock.calls.at(-1)![0].session).toEqual(
            current.status === 'available' ? current.value : undefined,
        );
        expect(createCode.mock.calls.at(-1)![0].session).not.toEqual(original.session);
    });

    it('reports missing session storage and does not install', async () => {
        const original = await snapshot();
        fixture.browser.storage.session = undefined as unknown as typeof fixture.session;
        const result = await manager.apply(original);
        expect(result).toMatchObject({ status: 'unavailable', reason: expect.stringContaining('storage.session') });
        expect(adapter.install).not.toHaveBeenCalled();
        expect(JSON.parse(fixture.local.values.get(REQUEST_KEY)!).policy).toEqual(original.policy);
    });

    it('does not attempt an API operation if persisting the requested state fails', async () => {
        fixture.local.set.mockRejectedValueOnce(new Error('local write rejected'));
        await expect(manager.apply(await snapshot())).rejects.toThrow('local write rejected');
        expect(adapter.checkAvailability).not.toHaveBeenCalled();
        expect(adapter.install).not.toHaveBeenCalled();
        expect((await manager.apply(await snapshot())).status).toBe('installed');
    });

    it('propagates unreadable trusted requested data without installing a default', async () => {
        fixture.local.values.set(REQUEST_KEY, '{');
        await expect(manager.reconcile()).rejects.toBeInstanceOf(SyntaxError);
        expect(adapter.install).not.toHaveBeenCalled();
        expect(adapter.remove).not.toHaveBeenCalled();
    });

    it('reconciles an absent request as disabled without guessing a policy', async () => {
        const result = await manager.reconcile();
        expect(result.status).toBe('disabled');
        expect(result.requested.revision).toBeNull();
        expect(adapter.install).not.toHaveBeenCalled();
    });

    it('acknowledges initial disabled Chromium state without unregistering an absent own ID', async () => {
        const unregister = vi.fn().mockRejectedValue(new Error('Unknown script ID'));
        chrome.userScripts = {
            getScripts: vi.fn().mockResolvedValue([]),
            unregister,
        } as unknown as typeof chrome.userScripts;
        const actual = new CanvasProtectionRegistration(new ChromiumCanvasRegistration(), createCode);
        const result = await actual.reconcile();
        expect(result).toMatchObject({ status: 'disabled', installed: { status: 'unavailable' } });
        expect(result.operations).toEqual([]);
        expect(chrome.userScripts.getScripts).not.toHaveBeenCalled();
        expect(result.reason).toBeUndefined();
        expect(result.requiredUserAction).toBeUndefined();
        expect(unregister).not.toHaveBeenCalled();
    });

    it('acknowledges repeated Chromium disable and reconciliation after the own registration was removed', async () => {
        let present = true;
        const unregister = vi.fn(async () => {
            if (!present) {
                throw new Error('Unknown script ID');
            }
            present = false;
        });
        chrome.userScripts = {
            getScripts: vi.fn(async () => (present
                ? [{ id: 'adguard-canvas-protection', js: [{ code: 'previously installed code' }] }] : [])),
            unregister,
        } as unknown as typeof chrome.userScripts;
        const actual = new CanvasProtectionRegistration(new ChromiumCanvasRegistration(), createCode);
        fixture.session.values.set(REGISTRATION_KEY, JSON.stringify({ revision: 'previous', generation: 'previous' }));
        const removed = await actual.disable(disabled);
        expect(removed.status).toBe('disabled');
        expect(removed.reason).toBeUndefined();
        expect(removed.requiredUserAction).toBeUndefined();
        expect(unregister).toHaveBeenCalledOnce();
        fixture.session.values.set(REGISTRATION_KEY, JSON.stringify({ revision: 'obsolete', generation: 'obsolete' }));
        const repeated = await actual.disable(disabled);
        expect(repeated).toMatchObject({ status: 'disabled', installed: { status: 'unavailable' } });
        expect(repeated.operations).toEqual([{ operation: 'check', status: 'succeeded' }]);
        expect(repeated.reason).toBeUndefined();
        expect(repeated.requiredUserAction).toBeUndefined();
        const reconciled = await actual.reconcile();
        expect(reconciled.status).toBe('disabled');
        expect(reconciled.reason).toBeUndefined();
        expect(reconciled.requiredUserAction).toBeUndefined();
        expect(unregister).toHaveBeenCalledOnce();
        expect(fixture.session.values.has(SNAPSHOT_KEY)).toBe(false);
        expect(fixture.session.values.has(REGISTRATION_KEY)).toBe(false);
    });

    it('preserves a real Chromium removal rejection as failed with prior acknowledgment history', async () => {
        const unregister = vi.fn().mockRejectedValue(new Error('Removal rejected'));
        chrome.userScripts = {
            getScripts: vi.fn().mockResolvedValue([
                { id: 'adguard-canvas-protection', js: [{ code: 'existing code' }] },
            ]),
            update: vi.fn().mockResolvedValue(undefined),
            unregister,
        } as unknown as typeof chrome.userScripts;
        const actual = new CanvasProtectionRegistration(new ChromiumCanvasRegistration(), createCode);
        const initial = await actual.apply(await snapshot());
        const result = await actual.disable(disabled);
        expect(result).toMatchObject({ status: 'failed', installed: initial.installed });
        expect(result.operations).toEqual([
            { operation: 'check', status: 'succeeded' },
            { operation: 'unregister', status: 'failed', reason: expect.stringContaining('Removal rejected') },
        ]);
        expect(unregister).toHaveBeenCalledOnce();
    });
    it('keeps absent legacy requests native without a browser API request', async () => {
        expect((await manager.reconcile()).status).toBe('disabled');
        expect(adapter.checkAvailability).not.toHaveBeenCalled();
        expect(adapter.install).not.toHaveBeenCalled();
        expect(adapter.remove).not.toHaveBeenCalled();
        expect(createCode).not.toHaveBeenCalled();
        expect(fixture.local.values.size).toBe(0);
    });

    it('checks and retires a persisted disable request after a context restart', async () => {
        await manager.apply(await snapshot());
        vi.mocked(adapter.checkAvailability).mockResolvedValue({ status: 'unavailable', reason: 'access revoked' });
        await manager.disable(disabled);
        vi.mocked(adapter.checkAvailability).mockResolvedValue({ status: 'available', value: true });
        const restarted = new CanvasProtectionRegistration(adapter, createCode);
        expect((await restarted.reconcile()).status).toBe('disabled');
        expect(adapter.remove).toHaveBeenCalledOnce();
    });

    it('skips requested-only disable when no request or acknowledgment exists', async () => {
        expect((await manager.disable(disabled)).status).toBe('disabled');
        expect(adapter.checkAvailability).not.toHaveBeenCalled();
        expect(adapter.remove).not.toHaveBeenCalled();
        expect(fixture.local.values.has(REQUEST_KEY)).toBe(false);
    });

    it('retires an acknowledged registration during requested-only disable without a local request', async () => {
        await manager.apply(await snapshot());
        fixture.local.values.delete(REQUEST_KEY);
        vi.mocked(adapter.checkAvailability).mockResolvedValue({ status: 'available', value: true });
        expect((await manager.disable(disabled)).status).toBe('disabled');
        expect(adapter.remove).toHaveBeenCalledOnce();
        expect(JSON.parse(fixture.local.values.get(REQUEST_KEY)!)).toEqual({ gates: disabled });
        expect(fixture.session.values.has(REGISTRATION_KEY)).toBe(false);
    });

    it('persists an enabled request without a policy and reports the missing artifact', async () => {
        const result = await manager.apply({ gates: enabled });
        expect(result).toMatchObject({
            status: 'unavailable',
            requested: { revision: null },
            requiredUserAction: 'Supply a prepared canvas protection policy',
        });
        expect(JSON.parse(fixture.local.values.get(REQUEST_KEY)!)).toEqual({ gates: enabled });
        expect(adapter.install).not.toHaveBeenCalled();
    });

    it('replaces a previous requested policy by omission without retiring its acknowledgment', async () => {
        const previous = await manager.apply(await snapshot());
        vi.mocked(adapter.checkAvailability).mockResolvedValue({ status: 'available', value: true });
        const result = await manager.apply({ gates: enabled });
        expect(result).toMatchObject({
            status: 'unavailable',
            installed: previous.installed,
            requested: { revision: null },
        });
        expect(JSON.parse(fixture.local.values.get(REQUEST_KEY)!)).toEqual({ gates: enabled });
        expect(adapter.install).toHaveBeenCalledOnce();
        expect(adapter.remove).not.toHaveBeenCalled();
    });

    it('persists the seed-free request before reporting unavailable session storage', async () => {
        fixture.browser.storage.session = undefined as unknown as typeof fixture.session;
        const policy = createProtectAllPolicy('chromium-mv3', 'policy-a');
        const result = await manager.apply({ gates: enabled, policy });
        expect(result).toMatchObject({ status: 'unavailable', reason: expect.stringContaining('storage.session') });
        expect(JSON.parse(fixture.local.values.get(REQUEST_KEY)!)).toEqual({ gates: enabled, policy });
        expect(adapter.install).not.toHaveBeenCalled();
        fixture.browser.storage.session = fixture.session;
        expect((await manager.reconcile()).status).toBe('installed');
        expect(createCode.mock.calls.at(-1)?.[0].session).toEqual(
            JSON.parse(fixture.session.values.get(SESSION_KEY)!),
        );
    });
});
