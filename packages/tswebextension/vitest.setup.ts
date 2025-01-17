import browser from 'sinon-chrome';
import { vi } from 'vitest';

import { MANIFEST_ENV } from './tasks/constants';

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
                        version: '5.0.176',
                        manifest_version: MANIFEST_ENV as any,
                    });
                }),
            },
        },
    };
});

vi.mock('nanoid/non-secure', () => ({
    nanoid: (): string => '1',
}));
