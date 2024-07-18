/**
 * A simple function to check if the current browser is Chromium-based.
 *
 * @returns `true` if the current browser is Chromium-based, `false` otherwise.
 * @see {@link https://stackoverflow.com/a/62797156}
 */
export const isChromium = (): boolean => {
    return typeof window !== 'undefined' && (
        Object.prototype.hasOwnProperty.call(window, 'chrome')
        || (typeof window.navigator !== 'undefined' && /chrome/i.test(window.navigator.userAgent || ''))
    );
};
