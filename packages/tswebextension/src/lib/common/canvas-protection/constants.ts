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
     * The browser acknowledged the current script.
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
 * Kind of document a prepared exclusion applies to.
 */
export enum CanvasPolicyRequestType {
    Document = 'document',
    Subdocument = 'subdocument',
}

/**
 * Type of a prepared condition.
 */
export enum CanvasConditionType {
    UrlRegexp = 'url-regexp',
    And = 'and',
    Or = 'or',
    Not = 'not',
    /**
     * A condition the producer could not express; it never matches.
     */
    Unavailable = 'unavailable',
}

/**
 * Flags of a prepared `url-regexp` condition.
 */
export enum CanvasConditionFlags {
    None = '',
    IgnoreCase = 'i',
}

/**
 * URL a prepared `url-regexp` condition is tested against.
 */
export enum CanvasConditionInput {
    FrameUrl = 'frame-url',
    TopUrl = 'top-url',
    SourceUrl = 'source-url',
}
