import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { CanvasPolicyBrowser } from '../../../../src/lib/common/canvas-protection/constants';
import { type ProtectionPolicyArtifact } from '../../../../src/lib/common/canvas-protection/contracts';
import { CanvasProtectionController } from '../../../../src/lib/common/canvas-protection/controller';
import { type CanvasProtectionRegistration } from '../../../../src/lib/common/canvas-protection/registration';

import { createProtectAllPolicy } from './fixtures/prepared-policies';

type Configuration = NonNullable<ReturnType<ConstructorParameters<typeof CanvasProtectionController>[1]>>;

const enabled = { filteringEnabled: true, stealthModeEnabled: true, protectCanvas: true };

describe('canvas protection controller', () => {
    let registration: { [Method in 'apply' | 'getState']: ReturnType<typeof vi.fn> };
    let configuration: Configuration | undefined;
    let controller: CanvasProtectionController;
    let policy: ProtectionPolicyArtifact;

    beforeEach(() => {
        registration = { apply: vi.fn(), getState: vi.fn() };
        policy = createProtectAllPolicy(CanvasPolicyBrowser.ChromiumMv3, 'policy-a');
        configuration = {
            settings: { filteringEnabled: true, stealthModeEnabled: true, stealth: { protectCanvas: true } },
            canvasProtectionPolicy: policy,
        };
        controller = new CanvasProtectionController(
            registration as unknown as CanvasProtectionRegistration,
            () => configuration,
        );
    });

    it('requests registration with the gates and policy of the current configuration', async () => {
        await controller.apply();
        expect(registration.apply).toHaveBeenLastCalledWith({ gates: enabled, policy });
        configuration = {
            ...configuration!, settings: { filteringEnabled: true, stealthModeEnabled: false, stealth: {} },
        };
        await controller.apply();
        expect(registration.apply).toHaveBeenLastCalledWith({
            gates: { filteringEnabled: true, stealthModeEnabled: false, protectCanvas: false }, policy,
        });
    });

    it('applies setter changes to the configuration', async () => {
        await controller.setEnabled(false);
        expect(configuration!.settings.stealth.protectCanvas).toBe(false);
        expect(registration.apply).toHaveBeenLastCalledWith({ gates: { ...enabled, protectCanvas: false }, policy });
        const replacement = createProtectAllPolicy(CanvasPolicyBrowser.ChromiumMv3, 'policy-b');
        await controller.setPolicy(replacement);
        expect(configuration!.canvasProtectionPolicy).toEqual(replacement);
    });

    it('rejects an invalid policy and a setter call without configuration', async () => {
        expect(() => controller.setPolicy({ ...policy, schemaVersion: 2 } as unknown as ProtectionPolicyArtifact))
            .toThrow();
        expect(configuration!.canvasProtectionPolicy).toBe(policy);
        configuration = undefined;
        expect(() => controller.setEnabled(true)).toThrow('Configuration not set!');
        expect(registration.apply).not.toHaveBeenCalled();
    });

    it('keeps registration off after stop until the next start', async () => {
        await controller.stop();
        const stopped = { gates: { ...enabled, filteringEnabled: false }, policy };
        expect(registration.apply).toHaveBeenLastCalledWith(stopped);
        await controller.setEnabled(true);
        expect(registration.apply).toHaveBeenCalledTimes(2);
        expect(registration.apply).toHaveBeenLastCalledWith(stopped);
        controller.resume();
        await controller.apply();
        expect(registration.apply).toHaveBeenLastCalledWith({ gates: enabled, policy });
    });

    it('requests removal when stopped without configuration', async () => {
        configuration = undefined;
        await controller.stop();
        expect(registration.apply).toHaveBeenCalledWith({
            gates: { filteringEnabled: false, stealthModeEnabled: false, protectCanvas: false },
            policy: undefined,
        });
    });
});
