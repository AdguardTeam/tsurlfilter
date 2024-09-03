declare global {
    interface Window {
        WebKitMutationObserver: MutationObserver;
    }
}
export declare const natives: {
    MutationObserver: {
        new (callback: MutationCallback): MutationObserver;
        prototype: MutationObserver;
    };
};
/**
 * Class NativeTextContent is needed to intercept and save the native Node textContent getter
 * for proper work of :contains() pseudo-class as it may be mocked.
 *
 * @see {@link https://github.com/AdguardTeam/ExtendedCss/issues/127}
 */
export declare class NativeTextContent {
    /**
     * Native Node.
     */
    private nativeNode;
    /**
     * Native Node textContent getter.
     */
    getter: (() => string) | undefined;
    /**
     * Stores native node.
     */
    constructor();
    /**
     * Sets native Node textContext getter to `getter` class field.
     */
    setGetter(): void;
}
export declare const nativeTextContent: NativeTextContent;
