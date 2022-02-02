import browser from 'sinon-chrome';

jest.mock('webextension-polyfill', () => ({
    ...browser,
    webRequest: {
        ...browser.webRequest,
        filterResponseData: jest.fn(),
    },
}));
