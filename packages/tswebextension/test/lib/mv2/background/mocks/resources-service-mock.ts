import { readFile } from 'fs/promises';
import * as path from 'path';

import { type ResourcesServiceInterface } from '../../../../../src/lib/mv2/background/services/resources-service';

/**
 * Mock for {@link ResourcesService}.
 */
export class ResourcesService implements ResourcesServiceInterface {
    public init = jest.fn();

    public stop = jest.fn();

    public createResourceUrl = jest.fn();

    /**
     * Mocks loading redirect resources.
     *
     * @returns Promise with resource content.
     */
    // eslint-disable-next-line class-methods-use-this
    public loadResource(): Promise<string> {
        return readFile(
            path.resolve(__dirname, '../fixtures/redirects.yml'),
            { encoding: 'utf-8' },
        );
    }
}
