/**
 * Check if the frame URL is about:blank or about:srcdoc.
 *
 * @param frameUrl Frame URL.
 *
 * @returns True if frame URL is about:blank or about:srcdoc, otherwise false.
 */
export const isEmptySrcFrame = (frameUrl: string): boolean => {
    return frameUrl === 'about:blank'
        || frameUrl === 'about:srcdoc';
};
