import {
    type CanvasAvailabilityStatus,
    type CanvasConditionType,
    type CanvasOperationStatus,
    type CanvasRegistrationOperation,
    type CanvasRegistrationStatus,
} from './constants';

/**
 * A browser-run root and independent generation, each encoded as 16 bytes of hex.
 */
export interface ProtectionSession {
    readonly root: string;
    readonly generation: string;
}

/**
 * The registration the browser last acknowledged. Holds no root seed.
 */
export interface CanvasRegistrationRecord {
    readonly revision: string;
    readonly generation: string;
    readonly codeHash: string;
}

/**
 * Canvas protection state that lives as long as the browser session.
 * The application context implements it on top of the extension session storage.
 */
export interface CanvasProtectionStore {
    canvasProtectionSession: ProtectionSession | undefined;
    canvasProtectionRegistration: CanvasRegistrationRecord | undefined;
}

/**
 * An exact synchronous value or the concrete reason it cannot be established.
 */
export type Available<T> =
    | { readonly status: CanvasAvailabilityStatus.Available; readonly value: T }
    | { readonly status: CanvasAvailabilityStatus.Unavailable; readonly reason: string };

/**
 * All three independent activation gates must be enabled for protection.
 */
export interface CanvasFeatureGates {
    readonly filteringEnabled: boolean;
    readonly stealthModeEnabled: boolean;
    readonly protectCanvas: boolean;
}

/**
 * Lookups of a top-level document's hostname, lowercase and without a trailing dot.
 * The hostname matches when any lookup matches.
 */
export interface HostCondition {
    readonly type: CanvasConditionType.Host;

    /**
     * Hosts matched as written or with a `www.` prefix.
     */
    readonly hosts: readonly string[];

    /**
     * Domains matched together with their subdomains at any depth.
     */
    readonly domains: readonly string[];

    /**
     * Domains whose subdomains one level below match after stripping `www.`.
     */
    readonly parents: readonly string[];

    /**
     * Regular expression for allowlist entries with a wildcard, tested against the whole hostname.
     */
    readonly pattern?: string;
}

/**
 * Exact JSON predicates evaluated against the hostname of a top-level document.
 */
export type PreparedCondition =
    | HostCondition
    | { readonly type: CanvasConditionType.Not; readonly operand: PreparedCondition };

/**
 * Synchronous facts about a delivered document. The browser reveals the complete
 * URL of a same-origin top document and only the origin of a cross-origin one;
 * a URL it does not reveal at all is `undefined`.
 */
export interface DocumentPolicyInput {
    readonly url: string;
    readonly topUrl: string | undefined;
}

/**
 * Browser operation evidence, including incomplete replacements or removals.
 */
export interface RegistrationOperationOutcome {
    readonly operation: CanvasRegistrationOperation;
    readonly status: CanvasOperationStatus;
    readonly reason?: string;
}

/**
 * Requested state remains distinct from the last browser-acknowledged state.
 */
export type RegistrationResult = {
    readonly requested: {
        readonly gates: CanvasFeatureGates;
        readonly revision: string | null;
    };
    readonly installed: Available<{
        readonly revision: string;
        readonly generation: string;
    }>;
    readonly operations: readonly RegistrationOperationOutcome[];
} & (
    | {
        readonly status: CanvasRegistrationStatus.Disabled | CanvasRegistrationStatus.Installed;
        readonly reason?: string;
        readonly requiredUserAction?: string;
    }
    | {
        readonly status: CanvasRegistrationStatus.Unavailable;
        readonly reason: string;
        readonly requiredUserAction: string;
    }
    | {
        readonly status: CanvasRegistrationStatus.Failed;
        readonly reason: string;
        readonly requiredUserAction?: string;
    }
);

/**
 * Trusted generated bootstrap state, captured before page code can read canvas.
 * Code is only delivered while every feature gate is enabled, so it carries none.
 */
export interface CanvasBootstrapSnapshot {
    readonly session: ProtectionSession;
    readonly policy: ProtectionPolicyArtifact;
}

/**
 * An owned byte readout with absolute bitmap coordinates and original bounds.
 */
export interface CanvasReadout {
    readonly data: Uint8ClampedArray;
    readonly width: number;
    readonly height: number;
    readonly originX: number;
    readonly originY: number;
    readonly canvasWidth: number;
    readonly canvasHeight: number;
    readonly colorSpace: PredefinedColorSpace;
}

/**
 * Seed-free canvas policy compiled by the library from filter rules and the allowlist.
 */
export interface ProtectionPolicyArtifact {
    /**
     * Hash of the other fields, reported to the consumer in {@link RegistrationResult}.
     */
    readonly revision: string;

    /**
     * Match patterns of the script registration, applied to each document's own URL.
     */
    readonly selectors: {
        /**
         * Documents that get the script.
         */
        readonly matches: readonly string[];

        /**
         * Documents that never get the script.
         */
        readonly excludeMatches: readonly string[];
    };

    /**
     * Conditions on the top-level document's hostname. A matching top-level document
     * stays native together with its frames.
     */
    readonly documentExclusions: readonly PreparedCondition[];
}
