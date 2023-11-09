import { MAIN_FRAME_ID } from '../tabs/frame';

/**
 * Checks if iframe has same source as main frame or if src is about:blank, javascript:, etc.
 * We don't include frames with 'src=data:' because Chrome and Firefox
 * do not allow data to be injected into frames with this type of src,
 * this bug is reported here https://bugs.chromium.org/p/chromium/issues/detail?id=55084.
 *
 * @param frameUrl Frame url.
 * @param frameId Unique id of frame in the tab.
 * @param mainFrameUrl Url of tab where iframe exists.
 * @returns True if frame without src, else returns false.
 */
export function isLocalFrame(frameUrl: string, frameId: number, mainFrameUrl: string): boolean {
    return frameId !== MAIN_FRAME_ID
        && (frameUrl === mainFrameUrl
            || frameUrl === 'about:blank'
            || frameUrl === 'about:srcdoc'
            // eslint-disable-next-line no-script-url
            || frameUrl.indexOf('javascript:') > -1);
}
