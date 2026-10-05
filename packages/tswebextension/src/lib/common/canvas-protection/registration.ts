/* eslint-disable max-classes-per-file -- The dependency error carries the adapter's partial operation evidence. */
import { logger } from '../utils/logger';

import {
    CanvasAvailabilityStatus,
    CanvasOperationStatus,
    CanvasRegistrationOperation,
    CanvasRegistrationStatus,
} from './constants';
import {
    type Available,
    type CanvasBootstrapSnapshot,
    type CanvasFeatureGates,
    type CanvasProtectionStore,
    type CanvasRegistrationRecord,
    type ProtectionPolicyArtifact,
    type RegistrationOperationOutcome,
    type RegistrationResult,
} from './contracts';
import { CanvasProtectionSession } from './session';

/**
 * The browser dependency owns registration presence and actual operation outcomes.
 */
export interface CanvasRegistrationAdapter {
    checkAvailability(): Promise<Available<boolean>>;
    install(code: string, policy: ProtectionPolicyArtifact): Promise<readonly RegistrationOperationOutcome[]>;
    remove(): Promise<readonly RegistrationOperationOutcome[]>;
}

/**
 * Contains browser operation evidence when an attempted change did not complete.
 */
export class CanvasRegistrationOperationError extends Error {
    /**
     * Successful and failed browser operations in their actual execution order.
     */
    public readonly operations: readonly RegistrationOperationOutcome[];

    /**
     * Preserves the dependency's concrete failure and partial results.
     *
     * @param message The browser dependency failure.
     * @param operations Actual successful and failed operations.
     */
    constructor(message: string, operations: readonly RegistrationOperationOutcome[]) {
        super(message);
        this.name = 'CanvasRegistrationOperationError';
        this.operations = operations;
    }
}

/**
 * Generates self-contained delivery code from the current trusted snapshot.
 */
export type CanvasProtectionCodeFactory = (snapshot: CanvasBootstrapSnapshot) => string;

/**
 * Requested state of canvas protection.
 */
export interface CanvasProtectionRequestedConfiguration {
    readonly gates: CanvasFeatureGates;
    readonly policy?: ProtectionPolicyArtifact;
}

/**
 * Serializes requested configuration and acknowledges only fulfilled browser operations.
 */
export class CanvasProtectionRegistration {
    /**
     * Serializes browser operations without poisoning later retries.
     */
    private queue: Promise<void> = Promise.resolve();

    /**
     * Older acknowledgments cannot complete a newer queued request.
     */
    private requestVersion = 0;

    /**
     * The requested decision is separate from the browser's last acknowledgment.
     */
    private state: RegistrationResult = {
        requested: {
            gates: { filteringEnabled: false, stealthModeEnabled: false, protectCanvas: false },
            revision: null,
        },
        installed: CanvasProtectionRegistration.summarize(undefined),
        operations: [],
        status: CanvasRegistrationStatus.Unavailable,
        reason: 'Canvas protection has not been configured',
        requiredUserAction: 'Supply canvas protection configuration',
    };

    /**
     * Owns registration lifecycle and code generation for a browser dependency.
     *
     * @param adapter The selected browser registration dependency.
     * @param createCode Generates delivery code from the current snapshot.
     * @param store Session state kept by the application context.
     */
    constructor(
        private readonly adapter: CanvasRegistrationAdapter,
        private readonly createCode: CanvasProtectionCodeFactory,
        private readonly store: CanvasProtectionStore,
    ) {}

    /**
     * Brings the browser registration in line with the requested configuration.
     *
     * @param configuration Requested gates and optional prepared policy.
     *
     * @returns The acknowledgment or concrete unresolved request result.
     */
    public apply(configuration: CanvasProtectionRequestedConfiguration): Promise<RegistrationResult> {
        // Setters mutate the application configuration later, so the queued request owns a copy.
        const requested = JSON.parse(JSON.stringify({
            gates: configuration.gates,
            policy: configuration.policy,
        })) as CanvasProtectionRequestedConfiguration;
        this.requestVersion += 1;
        const version = this.requestVersion;
        this.state = {
            ...this.state,
            requested: { gates: requested.gates, revision: requested.policy?.revision ?? null },
            operations: [],
            status: CanvasRegistrationStatus.Unavailable,
            reason: 'Canvas registration request is pending browser acknowledgment',
            requiredUserAction: 'Wait for the pending operation or apply the configuration again',
        };
        const request = this.queue.then(async () => {
            const result = await this.reconcile(requested);
            if ((result.status === CanvasRegistrationStatus.Failed
                || result.status === CanvasRegistrationStatus.Unavailable)
                && (requested.gates.protectCanvas || result.installed.status === CanvasAvailabilityStatus.Available)) {
                logger.warn(`[tsweb.CanvasProtectionRegistration.apply]: ${result.reason}`);
            }
            // A newer request stays pending, but learns what the browser acknowledged meanwhile.
            this.state = version === this.requestVersion
                ? result : { ...this.state, installed: result.installed };
            return result;
        });
        this.queue = request.then(() => undefined, () => undefined);
        return request;
    }

    /**
     * Returns requested state and operation evidence of the most recent request.
     *
     * @returns The most recent lifecycle result.
     */
    public getState(): RegistrationResult {
        return this.state;
    }

    /**
     * Performs the browser transition for one request.
     *
     * @param requested Requested gates and optional prepared policy.
     *
     * @returns A new acknowledgment only after the browser dependency fulfills.
     */
    private async reconcile(requested: CanvasProtectionRequestedConfiguration): Promise<RegistrationResult> {
        const { gates, policy } = requested;
        const active = gates.filteringEnabled && gates.stealthModeEnabled && gates.protectCanvas;
        let record = this.store.canvasProtectionRegistration;
        const result = {
            requested: { gates, revision: policy?.revision ?? null },
            installed: CanvasProtectionRegistration.summarize(record),
        };

        const availability = await this.adapter.checkAvailability();
        if (availability.status === CanvasAvailabilityStatus.Unavailable) {
            if (!active && !record) {
                return { ...result, operations: [], status: CanvasRegistrationStatus.Disabled };
            }
            return {
                ...result,
                operations: [{
                    operation: CanvasRegistrationOperation.Check,
                    status: CanvasOperationStatus.Failed,
                    reason: availability.reason,
                }],
                status: CanvasRegistrationStatus.Unavailable,
                reason: availability.reason,
                requiredUserAction: availability.reason,
            };
        }
        const check: RegistrationOperationOutcome = {
            operation: CanvasRegistrationOperation.Check,
            status: CanvasOperationStatus.Succeeded,
        };
        if (!availability.value && record) {
            // The browser dropped the registration, e.g. on an extension update.
            record = undefined;
            this.store.canvasProtectionRegistration = undefined;
            result.installed = CanvasProtectionRegistration.summarize(undefined);
        }
        if (!active && !availability.value) {
            return { ...result, operations: [check], status: CanvasRegistrationStatus.Disabled };
        }
        if (active && !policy) {
            return {
                ...result,
                operations: [check],
                status: CanvasRegistrationStatus.Unavailable,
                reason: 'A prepared canvas protection policy is required',
                requiredUserAction: 'Supply a prepared canvas protection policy',
            };
        }

        let code: string | undefined;
        let next: CanvasRegistrationRecord | undefined;
        if (active) {
            const session = this.store.canvasProtectionSession ?? CanvasProtectionSession.create();
            this.store.canvasProtectionSession = session;
            code = this.createCode({ session, policy: policy! });
            next = {
                revision: policy!.revision,
                generation: session.generation,
                codeHash: await CanvasProtectionRegistration.hash(code),
            };
            if (record?.codeHash === next.codeHash) {
                return { ...result, operations: [check], status: CanvasRegistrationStatus.Installed };
            }
        }

        let operations: readonly RegistrationOperationOutcome[];
        try {
            operations = code === undefined
                ? await this.adapter.remove() : await this.adapter.install(code, policy!);
        } catch (error) {
            if (!(error instanceof CanvasRegistrationOperationError)) {
                throw error;
            }
            return {
                ...result,
                operations: [check, ...error.operations],
                status: CanvasRegistrationStatus.Failed,
                reason: error.message,
            };
        }
        this.store.canvasProtectionRegistration = next;
        return {
            ...result,
            installed: CanvasProtectionRegistration.summarize(next),
            operations: [check, ...operations],
            status: next ? CanvasRegistrationStatus.Installed : CanvasRegistrationStatus.Disabled,
        };
    }

    /**
     * Describes an acknowledged registration without its code hash.
     *
     * @param record The last acknowledged registration, if any.
     *
     * @returns Installed summary reported to the consumer.
     */
    private static summarize(record: CanvasRegistrationRecord | undefined): RegistrationResult['installed'] {
        return record
            ? {
                status: CanvasAvailabilityStatus.Available,
                value: { revision: record.revision, generation: record.generation },
            }
            : { status: CanvasAvailabilityStatus.Unavailable, reason: 'No acknowledged active canvas registration' };
    }

    /**
     * Hashes generated code, so the stored record repeats neither the code nor its seed.
     *
     * @param code Generated delivery code.
     *
     * @returns SHA-256 of the code as lowercase hex.
     */
    private static async hash(code: string): Promise<string> {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
        return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    }
}
