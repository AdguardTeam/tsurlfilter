/* eslint-disable max-classes-per-file -- The dependency error carries the adapter's partial operation evidence. */
import browser from 'webextension-polyfill';

import { BrowserStorage } from '../storage/core';

import {
    type Available,
    type CanvasBootstrapSnapshot,
    type CanvasFeatureGates,
    type ProtectionPolicyArtifact,
    type RegistrationOperationOutcome,
    type RegistrationResult,
} from './contracts';
import { getProtectionSession } from './session';

const REQUEST_KEY = 'tswebextension.canvasProtectionRequested';
const SNAPSHOT_KEY = 'tswebextension.canvasProtectionRequestedSnapshot';
const REGISTRATION_KEY = 'tswebextension.canvasProtectionRegistration';
const DISABLED_GATES: CanvasFeatureGates = {
    filteringEnabled: false, stealthModeEnabled: false, protectCanvas: false,
};

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
 * Persistent requested state contains no session seed or generated code.
 */
export interface CanvasProtectionRequestedConfiguration {
    readonly gates: CanvasFeatureGates;
    readonly policy?: ProtectionPolicyArtifact;
}

/**
 * A seed-free summary of the last fully acknowledged installed snapshot.
 */
interface InstalledSummary {
    readonly revision: string;
    readonly generation: string;
}

/**
 * Indicates that no acknowledged active installation is known.
 *
 * @returns An unavailable installed summary.
 */
const noInstallation = (): Available<InstalledSummary> => ({
    status: 'unavailable', reason: 'No acknowledged active canvas registration',
});

/**
 * Captures trusted JSON configuration before an asynchronous request is queued.
 *
 * @param configuration Requested gates and optional prepared policy.
 *
 * @returns An owned seed-free request.
 */
const captureRequest = (
    configuration: CanvasProtectionRequestedConfiguration,
): CanvasProtectionRequestedConfiguration => (
    JSON.parse(JSON.stringify(configuration)) as CanvasProtectionRequestedConfiguration
);

/**
 * Serializes requested configuration and acknowledges only fulfilled browser operations.
 */
export class CanvasProtectionRegistration {
    /**
     * Serializes persistence and browser operations without poisoning later retries.
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
        requested: { gates: DISABLED_GATES, revision: null },
        installed: noInstallation(),
        operations: [],
        status: 'unavailable',
        reason: 'Canvas protection has not been configured',
        requiredUserAction: 'Supply canvas protection configuration',
    };

    /**
     * Owns registration lifecycle and code generation for a browser dependency.
     *
     * @param adapter The selected browser registration dependency.
     * @param createCode Generates delivery code from the current snapshot.
     */
    constructor(
        private readonly adapter: CanvasRegistrationAdapter,
        private readonly createCode: CanvasProtectionCodeFactory,
    ) {}

    /**
     * Applies requested gates and policy using the current stored session root.
     * Caller snapshots remain accepted without treating their session as authority.
     *
     * @param snapshot Trusted requested snapshot.
     *
     * @returns The acknowledgment or concrete unresolved request result.
     */
    public apply(snapshot: CanvasBootstrapSnapshot): Promise<RegistrationResult>;

    /**
     * Persists a seed-free request before resolving current session availability.
     *
     * @param configuration Requested gates and optional prepared policy.
     *
     * @returns The acknowledgment or concrete unresolved request result.
     */
    public apply(configuration: CanvasProtectionRequestedConfiguration): Promise<RegistrationResult>;

    /**
     * Captures an owned request before asynchronous persistence and browser work.
     *
     * @param configuration Trusted requested gates and optional prepared policy.
     *
     * @returns The acknowledgment or concrete unresolved request result.
     */
    public apply(configuration: CanvasProtectionRequestedConfiguration): Promise<RegistrationResult> {
        const requested = captureRequest({ gates: configuration.gates, policy: configuration.policy });
        return this.enqueue(async (version) => {
            const storage = new BrowserStorage<CanvasProtectionRequestedConfiguration>(browser.storage.local);
            const previous = await storage.get(REQUEST_KEY);
            if (previous === undefined && requested.policy === undefined && !requested.gates.protectCanvas
                && (!browser.storage.session || await new BrowserStorage<InstalledSummary>(browser.storage.session)
                    .get(REGISTRATION_KEY) === undefined)) {
                return this.publish({
                    requested: { gates: requested.gates, revision: null },
                    installed: noInstallation(),
                    operations: [],
                    status: 'disabled',
                }, version);
            }
            await storage.set(REQUEST_KEY, requested);
            return this.installRequested(requested, version);
        }, { gates: requested.gates, revision: requested.policy?.revision ?? null });
    }

    /**
     * Persists disabled gates before attempting to remove future delivery.
     *
     * @param gates The consumer's current feature gates.
     * @param onlyIfRequested Skip removal when no request or acknowledgment exists.
     *
     * @returns Acknowledged removal or an unresolved request with prior history.
     */
    public disable(gates: CanvasFeatureGates, onlyIfRequested = false): Promise<RegistrationResult> {
        const requestedGates = { ...gates };
        return this.enqueue(async (version) => {
            const storage = new BrowserStorage<CanvasProtectionRequestedConfiguration>(browser.storage.local);
            const previous = await storage.get(REQUEST_KEY);
            if (onlyIfRequested && previous === undefined
                && (!browser.storage.session || await new BrowserStorage<InstalledSummary>(browser.storage.session)
                    .get(REGISTRATION_KEY) === undefined)) {
                return this.publish({
                    requested: { gates: requestedGates, revision: null },
                    installed: noInstallation(),
                    operations: [],
                    status: 'disabled',
                }, version);
            }
            const requested = captureRequest({ gates: requestedGates, policy: previous?.policy });
            await storage.set(REQUEST_KEY, requested);
            return this.installRequested(requested, version);
        }, { gates: requestedGates, revision: this.state.requested.revision });
    }

    /**
     * Rehydrates the latest seed-free request and regenerates current delivery code.
     *
     * @returns The latest request's acknowledgment or concrete unresolved result.
     */
    public reconcile(): Promise<RegistrationResult> {
        return this.enqueue(async (version) => {
            const storage = new BrowserStorage<CanvasProtectionRequestedConfiguration>(browser.storage.local);
            const requested = await storage.get(REQUEST_KEY);
            if (requested === undefined
                && (!browser.storage.session || await new BrowserStorage<InstalledSummary>(browser.storage.session)
                    .get(REGISTRATION_KEY) === undefined)) {
                return this.publish({
                    requested: { gates: DISABLED_GATES, revision: null },
                    installed: noInstallation(),
                    operations: [],
                    status: 'disabled',
                }, version);
            }
            return this.installRequested(requested ?? { gates: DISABLED_GATES }, version);
        });
    }

    /**
     * Returns requested state and operation evidence, without treating history as current success.
     *
     * @returns The most recent lifecycle result.
     */
    public getState(): RegistrationResult {
        return this.state;
    }

    /**
     * Orders lifecycle work while allowing retries after rejected trusted storage operations.
     *
     * @param operation The next requested lifecycle operation.
     * @param requested An immediately known requested decision.
     *
     * @returns Completion of this operation.
     */
    private enqueue(
        operation: (version: number) => Promise<RegistrationResult>,
        requested = this.state.requested,
    ): Promise<RegistrationResult> {
        this.requestVersion += 1;
        const version = this.requestVersion;
        this.state = {
            ...this.state,
            requested,
            operations: [],
            status: 'unavailable',
            reason: 'Canvas registration request is pending browser acknowledgment',
            requiredUserAction: 'Wait for the pending operation or retry canvas protection reconciliation',
        };
        const request = this.queue.then(() => operation(version));
        this.queue = request.then(() => undefined, () => undefined);
        return request;
    }

    /**
     * Keeps a newer request pending while preserving earlier acknowledgment history.
     *
     * @param result The operation's own requested and acknowledged state.
     * @param version The request that produced this result.
     *
     * @returns This operation's result, independently of newer queued requests.
     */
    private publish(result: RegistrationResult, version: number): RegistrationResult {
        this.state = version === this.requestVersion
            ? result : { ...this.state, installed: result.installed };
        return result;
    }

    /**
     * Restores acknowledgment history and performs an exact requested browser transition.
     *
     * @param requested Trusted seed-free configuration.
     * @param version The request whose acknowledgment is being evaluated.
     *
     * @returns A new acknowledgment only after the browser dependency fulfills.
     */
    private async installRequested(
        requested: CanvasProtectionRequestedConfiguration,
        version: number,
    ): Promise<RegistrationResult> {
        const sessionStorage = browser.storage.session
            ? new BrowserStorage<InstalledSummary>(browser.storage.session) : undefined;
        const saved = await sessionStorage?.get(REGISTRATION_KEY);
        let installed: Available<InstalledSummary> = saved === undefined
            ? noInstallation() : { status: 'available', value: saved };
        const state = {
            requested: { gates: requested.gates, revision: requested.policy?.revision ?? null },
            installed,
            operations: [] as readonly RegistrationOperationOutcome[],
        };
        let result: RegistrationResult = {
            ...state,
            status: 'unavailable',
            reason: 'Canvas registration request is pending browser acknowledgment',
            requiredUserAction: 'Retry canvas protection reconciliation',
        };
        this.publish(result, version);
        const availability = await this.adapter.checkAvailability();
        const check: RegistrationOperationOutcome = availability.status === 'available'
            ? { operation: 'check', status: 'succeeded' }
            : { operation: 'check', status: 'failed', reason: availability.reason };
        if (availability.status === 'unavailable') {
            result = {
                ...state,
                operations: [check],
                status: 'unavailable',
                reason: availability.reason,
                requiredUserAction: availability.reason,
            };
            return this.publish(result, version);
        }
        if (!availability.value) {
            installed = noInstallation();
            await sessionStorage?.remove(REGISTRATION_KEY);
        }
        result = { ...result, installed, operations: [check] };
        this.publish(result, version);
        const active = requested.gates.filteringEnabled
            && requested.gates.stealthModeEnabled && requested.gates.protectCanvas;
        if (!active && !availability.value) {
            await sessionStorage?.remove(SNAPSHOT_KEY);
            return this.publish({
                requested: result.requested,
                installed: result.installed,
                operations: result.operations,
                status: 'disabled',
            }, version);
        }
        if (active && !requested.policy) {
            result = {
                ...result,
                status: 'unavailable',
                reason: 'A prepared canvas protection policy is required',
                requiredUserAction: 'Supply a prepared canvas protection policy',
            };
            return this.publish(result, version);
        }
        let bootstrap: CanvasBootstrapSnapshot | undefined;
        let code: string | undefined;
        if (active) {
            const session = await getProtectionSession();
            if (session.status === 'unavailable') {
                result = {
                    ...result,
                    status: 'unavailable',
                    reason: session.reason,
                    requiredUserAction: 'Use a browser with extension storage.session support',
                };
                return this.publish(result, version);
            }
            bootstrap = { session: session.value, gates: requested.gates, policy: requested.policy! };
            await new BrowserStorage<CanvasBootstrapSnapshot>(browser.storage.session).set(SNAPSHOT_KEY, bootstrap);
            code = this.createCode(bootstrap);
        }
        let operations: readonly RegistrationOperationOutcome[];
        try {
            operations = active
                ? await this.adapter.install(code!, requested.policy!) : await this.adapter.remove();
        } catch (error) {
            if (!(error instanceof CanvasRegistrationOperationError)) {
                throw error;
            }
            result = {
                ...result,
                status: 'failed',
                reason: error.message,
                operations: [check, ...error.operations],
            };
            return this.publish(result, version);
        }
        if (bootstrap) {
            const summary = { revision: bootstrap.policy.revision, generation: bootstrap.session.generation };
            await sessionStorage!.set(REGISTRATION_KEY, summary);
            installed = { status: 'available', value: summary };
        } else {
            await sessionStorage?.remove(REGISTRATION_KEY);
            await sessionStorage?.remove(SNAPSHOT_KEY);
            installed = noInstallation();
        }
        result = {
            ...state, installed, operations: [check, ...operations], status: active ? 'installed' : 'disabled',
        };
        return this.publish(result, version);
    }
}
