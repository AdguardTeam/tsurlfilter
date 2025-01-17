/**
 * Environment types for manifest version.
 */
export enum ManifestVersionEnv {
    Second = '2',
    Third = '3',
}

// By default we use the third version of the manifest.
export const MANIFEST_ENV = process.env.MANIFEST_ENV as ManifestVersionEnv || ManifestVersionEnv.Third;
