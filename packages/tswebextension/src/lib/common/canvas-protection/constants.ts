/**
 * Whether a value could be established.
 */
export enum CanvasAvailabilityStatus {
    Available = 'available',
    Unavailable = 'unavailable',
}

/**
 * State of the canvas protection script registration.
 */
export enum CanvasRegistrationStatus {
    /**
     * Protection is off and no script is registered.
     */
    Disabled = 'disabled',
    /**
     * The browser acknowledged the current script. Chromium MV2 has no registration,
     * so there it means the script is set up for injection.
     */
    Installed = 'installed',
    /**
     * A prerequisite is missing; `requiredUserAction` tells which.
     */
    Unavailable = 'unavailable',
    /**
     * A browser operation was rejected.
     */
    Failed = 'failed',
}

/**
 * Browser operation performed for the registration.
 */
export enum CanvasRegistrationOperation {
    Check = 'check',
    Register = 'register',
    Update = 'update',
    Unregister = 'unregister',
}

/**
 * Outcome of a browser operation.
 */
export enum CanvasOperationStatus {
    Succeeded = 'succeeded',
    Failed = 'failed',
}

/**
 * Why the policy compiler skips an exception rule that could affect canvas protection.
 */
export enum CanvasRuleSkipReason {
    Unparsable = 'unparsable',
    UnsupportedModifiers = 'unsupported modifiers',
    NotHostPattern = 'not a ||host^ pattern',
    WildcardHost = 'wildcard host',
    NotPlainHostname = 'not a plain hostname',
}

/**
 * Type of a prepared condition.
 */
export enum CanvasConditionType {
    Host = 'host',
    Not = 'not',
}
