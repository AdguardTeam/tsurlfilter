import { type CanvasFeatureGates, type ProtectionPolicyArtifact, type RegistrationResult } from './contracts';
import { CanvasPolicyCompiler, type PolicyAllowlist } from './policy-compiler';
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
}

/**
 * Shares configuration updates and keeps canvas registration stopped until start.
 */
export class CanvasProtectionController {
    private stopped = false;

    private policy: ProtectionPolicyArtifact | undefined;

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
        return this.registration.apply({ gates, policy: this.policy });
    }

    /**
     * Changes opt-in without changing the current session generation.
     *
     * @param enabled Requested protection setting.
     *
     * @returns The browser registration result.
     *
     * @throws When application configuration has not been supplied.
     */
    public async setEnabled(enabled: boolean): Promise<RegistrationResult> {
        this.requireConfiguration().settings.stealth.protectCanvas = enabled;
        return this.apply();
    }

    /**
     * Replaces canvas exclusions after the filtering engine has been rebuilt.
     *
     * @param ruleTexts Active document exception rule texts.
     * @param allowlist Configured platform allowlist.
     */
    public updatePolicy(ruleTexts: readonly string[], allowlist: PolicyAllowlist): void {
        this.policy = CanvasPolicyCompiler.compile(ruleTexts, allowlist);
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
