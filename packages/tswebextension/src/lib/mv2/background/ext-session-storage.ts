import browser from 'webextension-polyfill';
import { ExtensionStorage, createExtensionStorageDecorator } from '../../common/storage';
import type { ConfigurationMV2Context } from './configuration';
import { MemoryStorage } from './memory-storage';

export const enum SessionStorageKey {
    IsAppStarted = 'isAppStarted',
    Configuration = 'configuration',
}

export type SessionStorageSchema = {
    [SessionStorageKey.IsAppStarted]: boolean,
    [SessionStorageKey.Configuration]: ConfigurationMV2Context | undefined,
};

/**
 * API for storing data described by {@link SessionStorageSchema} in the {@link browser.storage.session}.
 */
export class ExtSessionStorage extends ExtensionStorage<SessionStorageSchema> {
    static readonly #DOMAIN = 'tswebextension';

    static readonly #DEFAULT_DATA: SessionStorageSchema = {
        isAppStarted: false,
        configuration: undefined,
    };

    /**
     * Creates {@link SessionStorage} instance.
     */
    constructor() {
        // Use memory storage as a fallback for old browsers.
        super(ExtSessionStorage.#DOMAIN, browser.storage.session ?? new MemoryStorage());
    }

    /** @inheritdoc */
    override init(): Promise<void> {
        return super.init(ExtSessionStorage.#DEFAULT_DATA);
    }
}

export const extSessionStorage = new ExtSessionStorage();

export const sessionDecorator = createExtensionStorageDecorator(extSessionStorage);
