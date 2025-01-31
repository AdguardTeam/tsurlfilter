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
    const storageData: Record<string, string> = {};

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
            // TODO: Move to separate mock file
            storage: {
                // Basic `browser.storage.local` mock implementation
                local: {
                    set: vi.fn(async (items: Record<string, any>) => {
                        for (const [key, value] of Object.entries(items)) {
                            storageData[key] = JSON.stringify(value);
                        }
                    }),

                    get: vi.fn(async (keys?: string | string[] | null) => {
                        if (keys === null) {
                            const result: Record<string, any> = {};
                            for (const [key, value] of Object.entries(storageData)) {
                                result[key] = JSON.parse(value);
                            }
                            return result;
                        }

                        if (typeof keys === 'string') {
                            const data = storageData[keys];
                            if (data !== undefined) {
                                return { [keys]: JSON.parse(data) };
                            }
                            return {};
                        }

                        if (Array.isArray(keys)) {
                            return keys.reduce((result, key) => {
                                const data = storageData[key];
                                if (data !== undefined) {
                                    result[key] = JSON.parse(data);
                                }
                                return result;
                            }, {} as Record<string, any>);
                        }

                        return {};
                    }),

                    remove: vi.fn(async (keys: string | string[]) => {
                        if (typeof keys === 'string') {
                            delete storageData[keys];
                        } else if (Array.isArray(keys)) {
                            keys.forEach((key) => {
                                delete storageData[key];
                            });
                        }
                    }),

                    clear: vi.fn(async () => {
                        Object.keys(storageData).forEach((key) => {
                            delete storageData[key];
                        });
                    }),
                },
            },
        },
    };
});

vi.mock('nanoid/non-secure', () => ({
    nanoid: (): string => '1',
}));
