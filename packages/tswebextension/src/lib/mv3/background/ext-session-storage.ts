import browser from 'webextension-polyfill';

import { BrowserStorage, MemoryStorage } from '../../common/storage/core';
import { ExtensionStorage, createExtensionStorageDecorator } from '../../common/storage';

import { type ConfigurationMV3Context } from './configuration';

export const enum SessionStorageKey {
    IsAppStarted = 'isAppStarted',
    Configuration = 'configuration',
    StartTimeMs = 'startTimeMs',
    CosmeticsInjectedOnStartup = 'cosmeticsInjectedOnStartup',
}

export type SessionStorageSchema = {
    [SessionStorageKey.IsAppStarted]: boolean;
    [SessionStorageKey.Configuration]: ConfigurationMV3Context | undefined;
    [SessionStorageKey.StartTimeMs]: number | undefined;
    [SessionStorageKey.CosmeticsInjectedOnStartup]: boolean;
};

/**
 * API for storing data described by {@link SessionStorageSchema} in the {@link browser.storage.session}.
 */
export class ExtSessionStorage extends ExtensionStorage<SessionStorageSchema> {
    static readonly #DOMAIN = 'tswebextension';

    static readonly #DEFAULT_DATA: SessionStorageSchema = {
        isAppStarted: false,
        configuration: undefined,
        startTimeMs: undefined,
        cosmeticsInjectedOnStartup: false,
    };

    /**
     * Creates {@link SessionStorage} instance.
     */
    constructor() {
        // Use memory storage as a fallback for old browsers and cases when the code
        // is launched outside the extension (case from partners)
        super(
            ExtSessionStorage.#DOMAIN,
            browser.storage.session
                ? new BrowserStorage<SessionStorageSchema>(browser.storage.session)
                : new MemoryStorage<SessionStorageSchema>(),
        );
    }

    /** @inheritdoc */
    override init(): Promise<void> {
        return super.init(ExtSessionStorage.#DEFAULT_DATA);
    }
}

export const extSessionStorage = new ExtSessionStorage();

export const sessionDecorator = createExtensionStorageDecorator(extSessionStorage);
