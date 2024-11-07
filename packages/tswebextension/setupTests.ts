import { cloneDeep } from 'lodash-es';
import browser from 'sinon-chrome';
import { TextEncoder, TextDecoder } from 'util';

global.chrome = {
    ...browser,
    // @ts-ignore
    scripting: {
        insertCSS: jest.fn(),
        executeScript: jest.fn(),
    },
};

// TODO: Set manifest 3 for mv3 tests.
browser.runtime.getManifest.returns({ version: '2', manifest_version: 2 });

jest.mock('webextension-polyfill', () => {
    const storageData: Record<string, string> = {};

    return {
        ...browser,
        webRequest: {
            ...browser.webRequest,
            filterResponseData: jest.fn(),
        },
        storage: {
            // Basic `browser.storage.local` mock implementation
            local: {
                set: jest.fn(async (items: Record<string, any>) => {
                    for (const [key, value] of Object.entries(items)) {
                        storageData[key] = JSON.stringify(value);
                    }
                }),

                get: jest.fn(async (keys?: string | string[] | null) => {
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

                remove: jest.fn(async (keys: string | string[]) => {
                    if (typeof keys === 'string') {
                        delete storageData[keys];
                    } else if (Array.isArray(keys)) {
                        keys.forEach((key) => {
                            delete storageData[key];
                        });
                    }
                }),

                clear: jest.fn(async () => {
                    Object.keys(storageData).forEach((key) => {
                        delete storageData[key];
                    });
                }),
            },
        },
    };
});

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

if (!global.structuredClone) {
    global.structuredClone = cloneDeep;
}
