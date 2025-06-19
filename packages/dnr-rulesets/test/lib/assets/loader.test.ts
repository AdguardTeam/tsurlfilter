import { copy } from 'fs-extra';
import path from 'path';
import process from 'process';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { AssetsLoader } from '../../../src/lib/assets/loader';

vi.mock('path', { spy: true });
vi.mock('process', { spy: true });
vi.mock('fs-extra');

describe('load', () => {
    const dest = 'dest';
    const src = 'src';
    const to = 'to';
    const filtersRelativePath = '../filters';

    const mockResolve = vi.mocked(path.resolve);
    const mockCopy = vi.mocked(copy);
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('cwd');

    beforeEach(() => {
        mockResolve
            .mockReturnValueOnce(to)
            .mockReturnValueOnce(src);
    });

    afterEach(() => {
        mockResolve.mockClear();
        mockCopy.mockClear();
        cwdSpy.mockClear();
    });

    it('should load assets', async () => {
        const loader = new AssetsLoader();

        await expect(loader.load(dest)).resolves.toBeUndefined();

        expect(mockResolve).toHaveBeenCalledTimes(2);
        expect(cwdSpy).toHaveBeenCalledTimes(1);
        expect(mockResolve).toHaveBeenCalledWith('cwd', dest);
        expect(mockResolve).toHaveBeenCalledWith(expect.any(String), filtersRelativePath);
        expect(mockCopy).toHaveBeenCalledTimes(1);
        expect(mockCopy).toHaveBeenCalledWith(src, to);
    });

    it('should throw an error if assets cannot be loaded', async () => {
        mockCopy.mockImplementationOnce(() => {
            throw new Error();
        });

        const loader = new AssetsLoader();

        await expect(loader.load(dest)).rejects.toThrow();

        expect(mockResolve).toHaveBeenCalledTimes(2);
        expect(cwdSpy).toHaveBeenCalledTimes(1);
        expect(mockResolve).toHaveBeenCalledWith('cwd', dest);
        expect(mockResolve).toHaveBeenCalledWith(expect.any(String), filtersRelativePath);
        expect(mockCopy).toHaveBeenCalledTimes(1);
        expect(mockCopy).toHaveBeenCalledWith(src, to);
    });
});
