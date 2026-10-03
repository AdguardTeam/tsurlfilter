import {
    type CanvasFeatureGates,
    type ProtectionPolicyArtifact,
    protectionPolicyArtifactValidator,
    type RegistrationResult,
} from './contracts';
import { type CanvasProtectionRegistration } from './registration';

/**
 * Configuration fields owned by the canvas consumer integration.
 */
interface CanvasConfiguration {
    readonly settings: {
        readonly filteringEnabled: boolean;
        readonly stealthModeEnabled: boolean;
        readonly stealth: { protectCanvas?: boolean };
    };
    canvasProtectionPolicy?: ProtectionPolicyArtifact;
}

/**
 * Shares configuration updates and keeps canvas registration stopped until start.
 */
export class CanvasProtectionController {
    private stopped = false;

    /**
     * Connects application configuration to its browser registration authority.
     *
     * @param registration The application's owned browser registration.
     * @param configuration Reads its current authoritative configuration.
     */
    constructor(
        private readonly registration: CanvasProtectionRegistration,
        private readonly configuration: () => CanvasConfiguration | undefined,
    ) {}

    /**
     * Allows the next start to register the current configuration again.
     */
    public resume(): void {
        this.stopped = false;
    }

    /**
     * Stops delivery and prevents later settings changes from restarting it.
     *
     * @returns The acknowledged removal or unresolved result.
     */
    public stop(): Promise<RegistrationResult> {
        this.stopped = true;
        return this.apply();
    }

    /**
     * Applies current settings while retaining the application stop gate.
     *
     * @returns The browser registration result.
     */
    public apply(): Promise<RegistrationResult> {
        const configuration = this.configuration();
        const settings = configuration?.settings;
        const gates: CanvasFeatureGates = {
            filteringEnabled: !this.stopped && settings?.filteringEnabled === true,
            stealthModeEnabled: settings?.stealthModeEnabled === true,
            protectCanvas: settings?.stealth.protectCanvas === true,
        };
        return this.stopped && !configuration ? this.registration.disable(gates)
            : this.registration.apply({ gates, policy: configuration?.canvasProtectionPolicy });
    }

    /**
     * Changes opt-in without changing the current session generation.
     *
     * @param enabled Requested protection setting.
     *
     * @returns The browser registration result.
     */
    public setEnabled(enabled: boolean): Promise<RegistrationResult> {
        this.requireConfiguration().settings.stealth.protectCanvas = enabled;
        return this.apply();
    }

    /**
     * Validates genuinely external policy input before storing the parsed value.
     *
     * @param policy Prepared selectors and exact exclusions.
     *
     * @returns The browser registration result.
     */
    public setPolicy(policy: ProtectionPolicyArtifact): Promise<RegistrationResult> {
        this.requireConfiguration().canvasProtectionPolicy = protectionPolicyArtifactValidator.parse(policy);
        return this.apply();
    }

    /**
     * Retries the persisted request while honoring an explicit application stop.
     *
     * @returns The current acknowledged or unresolved result.
     */
    public reconcile(): Promise<RegistrationResult> {
        return this.stopped ? this.apply() : this.registration.reconcile();
    }

    /**
     * Reads the latest registration result without probing page documents.
     *
     * @returns Requested and acknowledged state.
     */
    public getState(): RegistrationResult {
        return this.registration.getState();
    }

    /**
     * Requires application configuration before changing its settings.
     *
     * @returns The current configuration.
     *
     * @throws When application configuration has not been supplied.
     */
    private requireConfiguration(): CanvasConfiguration {
        const configuration = this.configuration();
        if (!configuration) {
            throw new Error('Configuration not set!');
        }
        return configuration;
    }
}
