import { z as zod } from 'zod';

import {
    type CanvasAvailabilityStatus,
    CanvasConditionInput,
    CanvasConditionType,
    type CanvasOperationStatus,
    CanvasPolicyBrowser,
    CanvasPolicyRequestType,
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
 * Exact JSON predicates evaluated against synchronous document information.
 */
export type PreparedCondition =
    | {
        readonly type: CanvasConditionType.UrlRegexp;
        readonly input: CanvasConditionInput;
        readonly pattern: string;
        readonly flags: '' | 'i';
    }
    | {
        readonly type: CanvasConditionType.And | CanvasConditionType.Or;
        readonly operands: readonly PreparedCondition[];
    }
    | { readonly type: CanvasConditionType.Not; readonly operand: PreparedCondition }
    | { readonly type: CanvasConditionType.Unavailable; readonly reason: string };

/**
 * A prepared exclusion with explicit top-document or child-frame applicability.
 */
export interface PreparedPolicyRule {
    readonly requestTypes: readonly CanvasPolicyRequestType[];
    readonly condition: PreparedCondition;
}

/**
 * Synchronous facts about a delivered document. The browser reveals the complete
 * URL of a same-origin top or parent document and only the origin of a
 * cross-origin one; a URL it does not reveal at all is `undefined`.
 */
export interface DocumentPolicyInput {
    readonly url: string;
    readonly requestType: CanvasPolicyRequestType;
    readonly topUrl: string | undefined;
    readonly sourceUrl: string | undefined;
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

const regexpConditionValidator = zod.object({
    type: zod.literal(CanvasConditionType.UrlRegexp),
    input: zod.nativeEnum(CanvasConditionInput),
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
    zod.object({
        type: zod.enum([CanvasConditionType.And, CanvasConditionType.Or]),
        operands: preparedConditionValidator.array(),
    }).strict(),
    zod.object({ type: zod.literal(CanvasConditionType.Not), operand: preparedConditionValidator }).strict(),
    zod.object({ type: zod.literal(CanvasConditionType.Unavailable), reason: zod.string().min(1) }).strict(),
]));

const preparedPolicyRuleValidator = zod.object({
    requestTypes: zod.nativeEnum(CanvasPolicyRequestType).array().min(1).readonly(),
    condition: preparedConditionValidator,
}).strict();

// A document exclusion is evaluated for the top-level document only, also on behalf of its frames.
const documentExclusionValidator = preparedPolicyRuleValidator.refine(
    (rule) => rule.requestTypes.includes(CanvasPolicyRequestType.Document),
    { message: 'A document exclusion must apply to documents', path: ['requestTypes'] },
);

/**
 * Validates genuinely external prepared JSON once before it enters trusted code.
 */
export const protectionPolicyArtifactValidator = zod.object({
    schemaVersion: zod.literal(1),
    revision: zod.string().min(1),
    browser: zod.nativeEnum(CanvasPolicyBrowser),
    selectors: zod.object({
        matches: zod.string().min(1).array().readonly(),
        excludeMatches: zod.string().min(1).array().readonly(),
    }).strict().readonly(),
    ownFrameExclusions: preparedPolicyRuleValidator.array().readonly(),
    documentExclusions: documentExclusionValidator.array().readonly(),
    unavailableConditions: zod.string().min(1).array().readonly(),
}).strict().readonly();

/**
 * A seed-free policy inferred from the external-input validator.
 */
export type ProtectionPolicyArtifact = zod.infer<typeof protectionPolicyArtifactValidator>;
