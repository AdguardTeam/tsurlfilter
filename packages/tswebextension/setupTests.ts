import browser from 'sinon-chrome';
import { TextEncoder, TextDecoder } from 'util';

global.chrome = {
    // @ts-ignore
    scripting: {
        insertCSS: jest.fn(),
        executeScript: jest.fn(),
    },
};

// TODO: Set manifest 3 for mv3 tests.
browser.runtime.getManifest.returns({ version: '2', manifest_version: 2 });

jest.mock('webextension-polyfill', () => ({
    ...browser,
    webRequest: {
        ...browser.webRequest,
        filterResponseData: jest.fn(),
    },
}));

jest.mock('nanoid', () => ({
    nanoid: (): string => '1',
}));

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
global.navigator = {};

declare global {
    // This property needed for Stealth Mode
    // See https://developer.mozilla.org/en-US/docs/Web/API/Navigator/globalPrivacyControl
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    interface Navigator { globalPrivacyControl: any; }
}

// JSDOM by default does not have TextEncoder and TextDecoder, expose them
// manually.
if (!global.TextEncoder) {
    global.TextEncoder = TextEncoder;
}
if (!global.TextDecoder) {
    // @ts-ignore
    global.TextDecoder = TextDecoder;
}
if (!global.Uint8Array) {
    global.Uint8Array = Uint8Array;
}
