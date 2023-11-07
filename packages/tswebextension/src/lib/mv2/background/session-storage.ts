import browser from 'webextension-polyfill';
import { ExtensionStorage, createExtensionStorageDecorator } from '../../common/storage';
import type { ConfigurationMV2Context } from './configuration';

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
export class SessionStorage extends ExtensionStorage<SessionStorageSchema> {
    static readonly #DOMAIN = 'tswebextension';

    static readonly #DEFAULT_DATA: SessionStorageSchema = {
        isAppStarted: false,
        configuration: undefined,
    };

    /**
     * Creates {@link SessionStorage} instance.
     */
    constructor() {
        super(SessionStorage.#DOMAIN, browser.storage.session);
    }

    /** @inheritdoc */
    override init(): Promise<void> {
        return super.init(SessionStorage.#DEFAULT_DATA);
    }
}

export const sessionStorage = new SessionStorage();

export const sessionDecorator = createExtensionStorageDecorator(sessionStorage);
