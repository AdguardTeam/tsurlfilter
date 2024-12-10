import browser from 'sinon-chrome';
import { vi } from 'vitest';

// Set up global `chrome` object
global.chrome = {
    ...browser,
    // @ts-ignore
    scripting: {
        insertCSS: vi.fn(),
        executeScript: vi.fn(),
    },
};

// Mock webextension-polyfill
vi.mock('webextension-polyfill', () => {
    return {
        default: {
            ...browser,
            webRequest: {
                ...browser.webRequest,
                filterResponseData: vi.fn(),
            },
            runtime: {
                ...browser.runtime,
                getManifest: vi.fn(() => {
                    return ({
                        version: '4.4.8',
                        manifest_version: 2,
                    });
                }),
            },
        },
    };
});

vi.mock('nanoid/non-secure', () => ({
    nanoid: (): string => '1',
}));
