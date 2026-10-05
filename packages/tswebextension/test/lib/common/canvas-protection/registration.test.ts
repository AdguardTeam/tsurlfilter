import { webcrypto } from 'node:crypto';

import {
    beforeEach,
    describe,
    expect,
    it,
    type Mock,
    vi,
} from 'vitest';

import {
    CanvasAvailabilityStatus,
    CanvasOperationStatus,
    CanvasPolicyBrowser,
    CanvasRegistrationOperation,
    CanvasRegistrationStatus,
} from '../../../../src/lib/common/canvas-protection/constants';
import {
    type CanvasBootstrapSnapshot,
    type CanvasFeatureGates,
    type CanvasProtectionStore,
    type RegistrationOperationOutcome,
} from '../../../../src/lib/common/canvas-protection/contracts';
import {
    CanvasProtectionRegistration,
    type CanvasRegistrationAdapter,
    CanvasRegistrationOperationError,
} from '../../../../src/lib/common/canvas-protection/registration';

import { createProtectAllPolicy } from './fixtures/prepared-policies';

const enabled: CanvasFeatureGates = { filteringEnabled: true, stealthModeEnabled: true, protectCanvas: true };
const disabled: CanvasFeatureGates = { ...enabled, protectCanvas: false };
const check: RegistrationOperationOutcome = {
    operation: CanvasRegistrationOperation.Check,
    status: CanvasOperationStatus.Succeeded,
};
const registered: RegistrationOperationOutcome = {
    operation: CanvasRegistrationOperation.Register,
    status: CanvasOperationStatus.Succeeded,
};
const unregistered: RegistrationOperationOutcome = {
    operation: CanvasRegistrationOperation.Unregister,
    status: CanvasOperationStatus.Succeeded,
};

/**
 * Builds an enabled request with a prepared test policy.
 *
 * @param revision Requested policy revision.
 *
 * @returns Request for the registration.
 */
const request = (revision = 'policy-a'): Parameters<CanvasProtectionRegistration['apply']>[0] => ({
    gates: enabled, policy: createProtectAllPolicy(CanvasPolicyBrowser.ChromiumMv3, revision),
});

describe('Canvas protection registration', () => {
    let present: boolean;
    let adapter: { [Method in keyof CanvasRegistrationAdapter]: Mock<CanvasRegistrationAdapter[Method]> };
    let createCode: Mock<(value: CanvasBootstrapSnapshot) => string>;
    let store: CanvasProtectionStore;
    let registration: CanvasProtectionRegistration;

    /**
     * Creates a registration over the shared store, like a restarted background does.
     *
     * @returns New registration.
     */
    const create = (): CanvasProtectionRegistration => new CanvasProtectionRegistration(adapter, createCode, store);

    beforeEach(() => {
        vi.stubGlobal('crypto', webcrypto);
        present = false;
        adapter = {
            checkAvailability: vi.fn(async () => ({ status: CanvasAvailabilityStatus.Available, value: present })),
            install: vi.fn(async () => {
                present = true;
                return [registered];
            }),
            remove: vi.fn(async () => {
                present = false;
                return [unregistered];
            }),
        };
        createCode = vi.fn((value) => JSON.stringify(value));
        store = { canvasProtectionSession: undefined, canvasProtectionRegistration: undefined };
        registration = create();
    });

    it('stays disabled without browser writes when protection is off', async () => {
        expect(registration.getState().status).toBe(CanvasRegistrationStatus.Unavailable);
        const result = await registration.apply({ gates: disabled });
        expect(result).toEqual({
            requested: { gates: disabled, revision: null },
            installed: { status: CanvasAvailabilityStatus.Unavailable, reason: expect.any(String) },
            operations: [check],
            status: CanvasRegistrationStatus.Disabled,
        });
        expect(registration.getState()).toBe(result);
        expect(adapter.install).not.toHaveBeenCalled();
        expect(adapter.remove).not.toHaveBeenCalled();
        expect(store.canvasProtectionSession).toBeUndefined();
    });

    it('stays disabled when the browser API is missing and protection is off', async () => {
        adapter.checkAvailability.mockResolvedValue({
            status: CanvasAvailabilityStatus.Unavailable,
            reason: 'no access',
        });
        expect(await registration.apply({ gates: disabled })).toMatchObject({
            status: CanvasRegistrationStatus.Disabled,
            operations: [],
        });
    });

    it('installs code with a new session and records the acknowledgment', async () => {
        const requested = request();
        const result = await registration.apply(requested);
        const session = store.canvasProtectionSession!;
        expect(createCode).toHaveBeenCalledWith({ session, policy: requested.policy });
        expect(adapter.install).toHaveBeenCalledWith(createCode.mock.results[0].value, requested.policy);
        expect(result).toEqual({
            requested: { gates: enabled, revision: 'policy-a' },
            installed: {
                status: CanvasAvailabilityStatus.Available,
                value: { revision: 'policy-a', generation: session.generation },
            },
            operations: [check, registered],
            status: CanvasRegistrationStatus.Installed,
        });
        expect(store.canvasProtectionRegistration).toEqual({
            revision: 'policy-a', generation: session.generation, codeHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        });
        expect(JSON.stringify(store.canvasProtectionRegistration)).not.toContain(session.root);
    });

    it('keeps the session and skips an identical installation, also after a background restart', async () => {
        const initial = await registration.apply(request());
        const session = store.canvasProtectionSession;
        expect(await registration.apply(request())).toEqual({ ...initial, operations: [check] });
        expect(await create().apply(request())).toEqual({ ...initial, operations: [check] });
        expect(adapter.install).toHaveBeenCalledOnce();
        expect(store.canvasProtectionSession).toBe(session);
    });

    it('installs again for another policy, another session or a registration the browser lost', async () => {
        await registration.apply(request());
        expect((await registration.apply(request('policy-b'))).installed).toMatchObject({
            value: { revision: 'policy-b' },
        });
        expect(adapter.install).toHaveBeenCalledTimes(2);

        // A browser restart clears the session storage, but Chromium keeps the registered script.
        store.canvasProtectionSession = undefined;
        store.canvasProtectionRegistration = undefined;
        await create().apply(request('policy-b'));
        expect(adapter.install).toHaveBeenCalledTimes(3);

        present = false;
        await registration.apply(request('policy-b'));
        expect(adapter.install).toHaveBeenCalledTimes(4);
    });

    it('removes the script when a gate is switched off', async () => {
        const requested = request();
        await registration.apply(requested);
        const result = await registration.apply({ ...requested, gates: { ...enabled, stealthModeEnabled: false } });
        expect(result).toMatchObject({
            status: CanvasRegistrationStatus.Disabled,
            installed: { status: CanvasAvailabilityStatus.Unavailable },
            operations: [check, unregistered],
        });
        expect(store.canvasProtectionRegistration).toBeUndefined();
    });

    it('removes a script left by a previous browser session', async () => {
        present = true;
        expect((await registration.apply({ gates: disabled })).operations).toEqual([check, unregistered]);
    });

    it('requires a prepared policy', async () => {
        expect(await registration.apply({ gates: enabled })).toMatchObject({
            status: CanvasRegistrationStatus.Unavailable,
            requiredUserAction: 'Supply a prepared canvas protection policy',
        });
        expect(adapter.install).not.toHaveBeenCalled();
    });

    it('reports a missing browser API and keeps the acknowledgment', async () => {
        const initial = await registration.apply(request());
        adapter.checkAvailability.mockResolvedValue({
            status: CanvasAvailabilityStatus.Unavailable,
            reason: 'no access',
        });
        const expected = {
            status: CanvasRegistrationStatus.Unavailable,
            reason: 'no access',
            requiredUserAction: 'no access',
            installed: initial.installed,
            operations: [{
                operation: CanvasRegistrationOperation.Check,
                status: CanvasOperationStatus.Failed,
                reason: 'no access',
            }],
        };
        expect(await registration.apply(request('policy-b'))).toMatchObject(expected);
        expect(await registration.apply({ gates: disabled })).toMatchObject(expected);
        expect(adapter.install).toHaveBeenCalledOnce();
        expect(adapter.remove).not.toHaveBeenCalled();
    });

    it('reports a failed operation with its partial evidence and allows a retry', async () => {
        const initial = await registration.apply(request());
        const failure: RegistrationOperationOutcome = {
            operation: CanvasRegistrationOperation.Unregister,
            status: CanvasOperationStatus.Failed,
            reason: 'rejected',
        };
        adapter.install.mockRejectedValueOnce(new CanvasRegistrationOperationError('retirement rejected', [
            registered, failure,
        ]));
        expect(await registration.apply(request('policy-b'))).toMatchObject({
            status: CanvasRegistrationStatus.Failed,
            reason: 'retirement rejected',
            installed: initial.installed,
            operations: [check, registered, failure],
        });
        adapter.install.mockRejectedValueOnce(new Error('unexpected'));
        await expect(registration.apply(request('policy-b'))).rejects.toThrow('unexpected');
        expect((await registration.apply(request('policy-b'))).status).toBe(CanvasRegistrationStatus.Installed);
    });

    it('runs overlapping requests in order and keeps the latest one pending', async () => {
        let acknowledge!: () => void;
        const blocked = new Promise<void>((resolve) => { acknowledge = resolve; });
        adapter.install.mockImplementationOnce(async () => {
            await blocked;
            present = true;
            return [registered];
        });
        const first = registration.apply(request('policy-first'));
        const latest = registration.apply(request('policy-latest'));
        const removal = registration.apply({ gates: disabled });
        await vi.waitFor(() => expect(adapter.install).toHaveBeenCalledOnce());
        expect(registration.getState()).toMatchObject({
            status: CanvasRegistrationStatus.Unavailable,
            requested: { gates: disabled },
        });
        acknowledge();
        expect((await first).status).toBe(CanvasRegistrationStatus.Installed);
        expect(registration.getState()).toMatchObject({
            status: CanvasRegistrationStatus.Unavailable,
            requested: { gates: disabled },
            installed: { value: { revision: 'policy-first' } },
        });
        expect((await latest).installed).toMatchObject({ value: { revision: 'policy-latest' } });
        const removed = await removal;
        expect(removed.status).toBe(CanvasRegistrationStatus.Disabled);
        expect(registration.getState()).toBe(removed);
    });

    it('owns a copy of the request', async () => {
        const requested = {
            gates: { ...enabled },
            policy: createProtectAllPolicy(CanvasPolicyBrowser.ChromiumMv3, 'policy-a'),
        };
        const pending = registration.apply(requested);
        requested.gates.protectCanvas = false;
        expect((await pending).status).toBe(CanvasRegistrationStatus.Installed);
    });
});
