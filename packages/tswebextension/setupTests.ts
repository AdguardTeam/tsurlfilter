import browser from 'sinon-chrome';

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
