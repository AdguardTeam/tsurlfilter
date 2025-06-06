import fs from 'fs';

import { type Manifest, ManifestParser, type ManifestParserInterface } from './parser';

/**
 * Api for loading manifest.
 */
export interface ManifestLoaderInterface {
    /**
     * Load manifest from file with specified {@link path}.
     *
     * @param path Path to manifest.
     *
     * @returns Parsed manifest.
     *
     * @throws Error if manifest file is not found.
     * @throws Error If manifest data is invalid.
     */
    load(path: string): Manifest;
};

/**
 * Api for loading manifest.
 *
 * @see {@link ManifestLoaderInterface}
 */
export class ManifestLoader implements ManifestLoaderInterface {
    /**
     * Create new instance of {@link ManifestLoader}.
     *
     * @param parser {@link ManifestParser}.
     */
    constructor(private parser: ManifestParserInterface = new ManifestParser()) {}

    /** @inheritdoc */
    public load(path: string): Manifest {
        const data = fs.readFileSync(path, { encoding: 'utf-8' });
        return this.parser.parse(data);
    }
}
