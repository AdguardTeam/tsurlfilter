import fs from 'fs';

import { ManifestLoader } from '../../../src/lib/manifest/loader';

jest.mock('fs');

describe('ManifestLoader', () => {
    const manifestPath = 'manifest.json';
    const manifest = { manifest_version: 3 };
    const stringifiedManifest = JSON.stringify(manifest);

    const mockReadFileSync = jest.mocked(fs.readFileSync).mockReturnValue(stringifiedManifest); ;
    const mockParse = jest.fn().mockReturnValue(manifest);

    afterEach(() => {
        mockReadFileSync.mockClear();
        mockParse.mockClear();
    });

    it('should be initialized', () => {
        expect(new ManifestLoader()).toBeInstanceOf(ManifestLoader);
    });

    it('should load a manifest', () => {
        const loader = new ManifestLoader({ parse: mockParse });

        expect(loader.load(manifestPath)).toEqual(manifest);

        expect(mockReadFileSync).toHaveBeenCalledTimes(1);
        expect(mockReadFileSync).toHaveBeenCalledWith(manifestPath, { encoding: 'utf-8' });
        expect(mockParse).toHaveBeenCalledTimes(1);
        expect(mockParse).toHaveBeenCalledWith(stringifiedManifest);
    });

    it('should throw an error if manifest cannot be loaded', () => {
        mockReadFileSync.mockImplementationOnce(() => {
            throw new Error();
        });

        const loader = new ManifestLoader({ parse: mockParse });

        expect(() => loader.load(manifestPath)).toThrow();

        expect(mockReadFileSync).toHaveBeenCalledTimes(1);
        expect(mockReadFileSync).toHaveBeenCalledWith(manifestPath, { encoding: 'utf-8' });
        expect(mockParse).not.toHaveBeenCalled();
    });

    it('should throw an error if manifest is invalid', () => {
        mockParse.mockImplementationOnce(() => {
            throw new Error();
        });

        const loader = new ManifestLoader({ parse: mockParse });

        expect(() => loader.load(manifestPath)).toThrow();

        expect(mockReadFileSync).toHaveBeenCalledTimes(1);
        expect(mockReadFileSync).toHaveBeenCalledWith(manifestPath, { encoding: 'utf-8' });
        expect(mockParse).toHaveBeenCalledTimes(1);
        expect(mockParse).toHaveBeenCalledWith(stringifiedManifest);
    });
});
