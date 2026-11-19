import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    type CanvasPolicyInput,
    CanvasProtectionController,
} from '../../../../src/lib/common/canvas-protection/controller';
import { CanvasPolicyCompiler } from '../../../../src/lib/common/canvas-protection/policy-compiler';
import { type CanvasProtectionRegistration } from '../../../../src/lib/common/canvas-protection/registration';

type Configuration = NonNullable<ReturnType<ConstructorParameters<typeof CanvasProtectionController>[1]>>;

const disabledAllowlist = { enabled: false, inverted: false, domains: [] };
const policy = CanvasPolicyCompiler.compile([], disabledAllowlist);
const enabled = { filteringEnabled: true, stealthModeEnabled: true, protectCanvas: true };

describe('canvas protection controller', () => {
    let registration: { [Method in 'apply' | 'getState']: ReturnType<typeof vi.fn> };
    let configuration: Configuration | undefined;
    let readPolicyInput: ReturnType<typeof vi.fn<() => CanvasPolicyInput>>;
    let controller: CanvasProtectionController;

    beforeEach(() => {
        registration = { apply: vi.fn(), getState: vi.fn() };
        configuration = {
            settings: { filteringEnabled: true, stealthModeEnabled: true, stealth: { protectCanvas: true } },
        };
        readPolicyInput = vi.fn(() => ({ ruleTexts: [], allowlist: disabledAllowlist }));
        controller = new CanvasProtectionController(
            registration as unknown as CanvasProtectionRegistration,
            () => configuration,
            readPolicyInput,
        );
    });

    it('requests registration with the gates and the compiled policy', async () => {
        await controller.apply();
        expect(registration.apply).toHaveBeenLastCalledWith({ gates: enabled, policy: undefined });
        controller.invalidatePolicy();
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

    it('compiles the policy once, on the first application with every gate enabled', async () => {
        configuration!.settings.stealth.protectCanvas = false;
        controller.invalidatePolicy();
        await controller.apply();
        expect(readPolicyInput).not.toHaveBeenCalled();
        expect(registration.apply).toHaveBeenLastCalledWith({
            gates: { ...enabled, protectCanvas: false }, policy: undefined,
        });
        await controller.setEnabled(true);
        await controller.apply();
        expect(readPolicyInput).toHaveBeenCalledOnce();
        expect(registration.apply).toHaveBeenLastCalledWith({ gates: enabled, policy });
        controller.invalidatePolicy();
        await controller.setEnabled(false);
        expect(registration.apply).toHaveBeenLastCalledWith({
            gates: { ...enabled, protectCanvas: false }, policy: undefined,
        });
        await controller.setEnabled(true);
        expect(readPolicyInput).toHaveBeenCalledTimes(2);
    });

    it('applies setter changes to the configuration', async () => {
        controller.invalidatePolicy();
        await controller.apply();
        await controller.setEnabled(false);
        expect(configuration!.settings.stealth.protectCanvas).toBe(false);
        expect(registration.apply).toHaveBeenLastCalledWith({ gates: { ...enabled, protectCanvas: false }, policy });
    });

    it('compiles the current exceptions after an update', async () => {
        readPolicyInput.mockReturnValue({ ruleTexts: ['@@||example.org^$stealth'], allowlist: disabledAllowlist });
        controller.invalidatePolicy();
        await controller.apply();
        expect(registration.apply).toHaveBeenLastCalledWith({
            gates: enabled,
            policy: expect.objectContaining({ selectors: { matches: ['<all_urls>'], excludeMatches: ['*://*.example.org/*'] } }),
        });
    });

    it('rejects a setter call without configuration', async () => {
        configuration = undefined;
        await expect(controller.setEnabled(true)).rejects.toThrow('Configuration not set!');
        expect(registration.apply).not.toHaveBeenCalled();
    });

    it('keeps registration off after stop until the next start', async () => {
        controller.invalidatePolicy();
        await controller.stop();
        const stopped = { gates: { ...enabled, filteringEnabled: false }, policy: undefined };
        expect(registration.apply).toHaveBeenLastCalledWith(stopped);
        await controller.setEnabled(true);
        expect(registration.apply).toHaveBeenCalledTimes(2);
        expect(registration.apply).toHaveBeenLastCalledWith(stopped);
        expect(readPolicyInput).not.toHaveBeenCalled();
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
