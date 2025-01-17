import { readFile } from 'fs/promises';
import * as path from 'path';

import { vi } from 'vitest';

import { type ResourcesServiceInterface } from '../../../../../src/lib/mv2/background/services/resources-service';

/**
 * Mock for {@link ResourcesService}.
 */
export class ResourcesService implements ResourcesServiceInterface {
    public init = vi.fn();

    public stop = vi.fn();

    public createResourceUrl = vi.fn();

    /**
     * Mocks loading redirect resources.
     *
     * @returns Promise with resource content.
     */
    // eslint-disable-next-line class-methods-use-this
    public loadResource = vi.fn().mockImplementation((): Promise<string> => {
        return readFile(
            path.resolve(__dirname, '../fixtures/redirects.yml'),
            { encoding: 'utf-8' },
        );
    });
}
