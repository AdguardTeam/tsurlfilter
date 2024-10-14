import browser from 'webextension-polyfill';
import { versionsIdbStorage } from './storage';

/**
 * A utility class for handling operations related to the extension version.
 * This includes retrieving the current version, checking for updates, and
 * updating the stored version.
 */
export class VersionManager {
    /**
     * The key used to store the extension version in persistent storage.
     */
    private static readonly EXTENSION_VERSION_KEY = 'extensionVersion';

    /**
     * Retrieves the current version of the extension as specified in the
     * extension's manifest file.
     *
     * @returns The current extension version as defined in the
     * manifest (e.g., "1.0.0").
     */
    public static getExtensionVersion(): string {
        return browser.runtime.getManifest().version;
    }

    /**
     * Determines whether the extension has been updated by comparing the
     * current version with the version stored in persistent storage.
     *
     * @returns A promise that resolves to `true` if the
     * extension version has changed since the last recorded version, otherwise `false`.
     *
     * @example
     * const hasUpdated = await VersionHandler.isExtensionUpdated();
     * if (hasUpdated) {
     *   console.log('Extension has been updated.');
     * }
     */
    public static async isExtensionUpdated(): Promise<boolean> {
        // Read the previous version from storage
        const previousVersion = await versionsIdbStorage.get(VersionManager.EXTENSION_VERSION_KEY);
        const currentVersion = VersionManager.getExtensionVersion();

        return previousVersion !== currentVersion;
    }

    /**
     * Updates the stored extension version to the current version. This is
     * typically called after an update has been detected to keep the storage
     * in sync with the extension's actual version.
     *
     * @returns A promise that resolves once the version has
     * been successfully updated in storage.
     *
     * @example
     * await VersionHandler.updateExtensionVersion();
     * console.log('Extension version updated in storage.');
     */
    public static async updateExtensionVersion(): Promise<void> {
        const currentVersion = VersionManager.getExtensionVersion();
        await versionsIdbStorage.set(VersionManager.EXTENSION_VERSION_KEY, currentVersion);
    }
}
