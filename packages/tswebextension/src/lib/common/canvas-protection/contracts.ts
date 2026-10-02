import { z as zod } from 'zod';

/**
 * A browser-run root and independent generation, each encoded as 16 bytes of hex.
 */
export interface ProtectionSession {
    readonly root: string;
    readonly generation: string;
}

/**
 * An exact synchronous value or the concrete reason it cannot be established.
 */
export type Available<T> =
    | { readonly status: 'available'; readonly value: T }
    | { readonly status: 'unavailable'; readonly reason: string };

/**
 * A complete hostname key with the document URL and context used to resolve it.
 */
export interface SiteIdentity {
    readonly key: string;
    readonly mode: 'top-derived' | 'frame-local';
    readonly sourceUrl: string;
}

/**
 * All three independent activation gates must be enabled for protection.
 */
export interface CanvasFeatureGates {
    readonly filteringEnabled: boolean;
    readonly stealthModeEnabled: boolean;
    readonly protectCanvas: boolean;
}

/**
 * Exact JSON predicates evaluated against synchronous document information.
 */
export type PreparedCondition =
    | {
        readonly type: 'url-regexp';
        readonly input: 'frame-url' | 'top-url' | 'source-url';
        readonly pattern: string;
        readonly flags: '' | 'i';
    }
    | { readonly type: 'and' | 'or'; readonly operands: readonly PreparedCondition[] }
    | { readonly type: 'not'; readonly operand: PreparedCondition }
    | { readonly type: 'unavailable'; readonly reason: string };

/**
 * A prepared exclusion with explicit top-document or child-frame applicability.
 */
export interface PreparedPolicyRule {
    readonly requestTypes: readonly ('document' | 'subdocument')[];
    readonly condition: PreparedCondition;
}

/**
 * A seed-free policy whose native selectors deliver candidates for exact predicates.
 */
export interface ProtectionPolicyArtifact {
    readonly schemaVersion: 1;
    readonly revision: string;
    readonly browser: 'chromium-mv3' | 'firefox-mv2';
    readonly selectors: {
        readonly matches: readonly string[];
        readonly excludeMatches: readonly string[];
    };
    readonly ownFrameExclusions: readonly PreparedPolicyRule[];
    readonly documentExclusions: readonly PreparedPolicyRule[];
    readonly unavailableConditions: readonly string[];
}

/**
 * Trusted captured top state; each unavailable field retains its own provenance.
 */
export interface InheritedTopContext {
    readonly documentExcluded: Available<boolean>;
    readonly allowlistExcluded: Available<boolean>;
    readonly site: Available<SiteIdentity>;
    readonly policyRevision: Available<string>;
    readonly capturedGeneration: Available<string>;
}

/**
 * Synchronous input from a delivered document, without inferred referrer semantics.
 */
export interface DocumentPolicyInput {
    readonly url: string;
    readonly requestType: 'document' | 'subdocument';
    readonly inheritedTop: Available<InheritedTopContext>;
    readonly sourceUrl: Available<string>;
}

/**
 * An immutable decision whose enablement is independent of context completeness.
 */
export interface DocumentProtectionContext {
    readonly outcome: 'enabled' | 'disabled' | 'excluded' | 'unsupported';
    readonly enabled: boolean;
    readonly excluded: boolean;
    readonly gates: CanvasFeatureGates;
    readonly policyRevision: string;
    readonly capturedGeneration: string;
    readonly site: Available<SiteIdentity>;
    readonly provenance: {
        readonly requestType: DocumentPolicyInput['requestType'];
        readonly frameUrl: string;
        readonly sourceUrl: Available<string>;
        readonly inheritedTop: Available<InheritedTopContext>;
        readonly ownFrameExclusion: Available<boolean>;
        readonly documentExclusion: Available<boolean>;
    };
    readonly unavailableConditions: readonly string[];
}

/**
 * Browser operation evidence, including incomplete replacements or removals.
 */
export interface RegistrationOperationOutcome {
    readonly operation: 'check' | 'register' | 'update' | 'unregister';
    readonly status: 'succeeded' | 'failed';
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
        readonly status: 'disabled' | 'installed';
        readonly reason?: string;
        readonly requiredUserAction?: string;
    }
    | { readonly status: 'unavailable'; readonly reason: string; readonly requiredUserAction: string }
    | { readonly status: 'failed'; readonly reason: string; readonly requiredUserAction?: string }
);

/**
 * Trusted generated bootstrap state, captured before page code can read canvas.
 */
export interface CanvasBootstrapSnapshot {
    readonly session: ProtectionSession;
    readonly gates: CanvasFeatureGates;
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

const regexpConditionValidator = zod.object({
    type: zod.literal('url-regexp'),
    input: zod.enum(['frame-url', 'top-url', 'source-url']),
    pattern: zod.string(),
    flags: zod.enum(['', 'i']),
}).strict().superRefine((condition, context) => {
    try {
        // Validate syntax once at the external boundary; downstream predicates are trusted.
        new RegExp(condition.pattern, condition.flags);
    } catch {
        context.addIssue({
            code: zod.ZodIssueCode.custom,
            message: 'Invalid URL regular expression',
            path: ['pattern'],
        });
    }
});

const preparedConditionValidator: zod.ZodType<PreparedCondition> = zod.lazy(() => zod.union([
    regexpConditionValidator,
    zod.object({ type: zod.enum(['and', 'or']), operands: preparedConditionValidator.array() }).strict(),
    zod.object({ type: zod.literal('not'), operand: preparedConditionValidator }).strict(),
    zod.object({ type: zod.literal('unavailable'), reason: zod.string().min(1) }).strict(),
]));

const preparedPolicyRuleValidator = zod.object({
    requestTypes: zod.enum(['document', 'subdocument']).array(),
    condition: preparedConditionValidator,
}).strict();

/**
 * Validates genuinely external prepared JSON once before it enters trusted code.
 */
export const protectionPolicyArtifactValidator: zod.ZodType<ProtectionPolicyArtifact> = zod.object({
    schemaVersion: zod.literal(1),
    revision: zod.string().min(1),
    browser: zod.enum(['chromium-mv3', 'firefox-mv2']),
    selectors: zod.object({
        matches: zod.string().min(1).array(),
        excludeMatches: zod.string().min(1).array(),
    }).strict(),
    ownFrameExclusions: preparedPolicyRuleValidator.array(),
    documentExclusions: preparedPolicyRuleValidator.array(),
    unavailableConditions: zod.string().min(1).array(),
}).strict();
