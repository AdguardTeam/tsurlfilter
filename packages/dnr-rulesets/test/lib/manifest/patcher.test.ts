import fs from 'fs';
import path from 'path';

import type { RulesetPathGenerator } from '../../../src/lib/manifest/injector';
import type { Manifest } from '../../../src/lib/manifest/parser';
import { ManifestPatcher } from '../../../src/lib/manifest/patcher';

jest.mock('fs');
jest.mock('path');

describe('ManifestPatcher', () => {
    const cwd = 'cwd';
    const dir = 'dir';
    const manifestPath = `${dir}/manifest.json`;
    const filtersPath = `${dir}/filters`;
    const filterNames = ['filter_1', 'filter_2'];

    const mockIsAbsolute = jest.mocked(path.isAbsolute).mockReturnValue(true);
    // jest cannot mock process.cwd() directly, so we need to use spy
    const cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(cwd);
    const mockResolve = jest.mocked(path.resolve);
    const mockExistsSync = jest.mocked(fs.existsSync).mockReturnValue(true);
    const mockRelative = jest.mocked(path.relative);
    const mockDirname = jest.mocked(path.dirname).mockReturnValue(dir);
    const mockReaddirSync = jest.mocked<(path: string) => string[]>(fs.readdirSync).mockReturnValue(filterNames);
    const mockWriteFileSync = jest.mocked(fs.writeFileSync);

    const manifest = {
        manifest_version: 3,
        background: {
            service_worker: 'pages/background.js',
        },
    };

    const declarative_net_request = {
        rule_resources: [{
            id: 'ruleset_1',
            enabled: false,
            path: 'test',
        }, {
            id: 'ruleset_2',
            enabled: false,
            path: 'test',
        }],
    };

    const mockLoader = {
        load: jest.fn().mockReturnValue(manifest),
    };

    const mockInjector = {
        applyRulesets: jest.fn().mockImplementation((
            generateRulesetPath: RulesetPathGenerator,
            manifest: Manifest,
            filterNames: string[],
        ) => {
            filterNames.forEach((filterName) => {
                const rulesetIndexMatch = filterName.match(/\d+/);
                if (!rulesetIndexMatch) {
                    return;
                }

                generateRulesetPath(`ruleset_${rulesetIndexMatch[0]}`);
            });

            return { ...manifest, declarative_net_request };
        }),
    };

    afterEach(() => {
        mockIsAbsolute.mockClear();
        cwdSpy.mockClear();
        mockResolve.mockClear();
        mockExistsSync.mockClear();
        mockRelative.mockClear();
        mockDirname.mockClear();
        mockReaddirSync.mockClear();
        mockWriteFileSync.mockClear();
        mockLoader.load.mockClear();
        mockInjector.applyRulesets.mockClear();
    });

    it('should be initialized', () => {
        expect(new ManifestPatcher()).toBeInstanceOf(ManifestPatcher);
    });

    it('should apply rulesets to manifest when absolute paths are provided', () => {
        const patcher = new ManifestPatcher(mockLoader, mockInjector);

        patcher.patch(manifestPath, filtersPath);

        expect(mockIsAbsolute).toHaveBeenCalledTimes(2);
        expect(mockIsAbsolute).toHaveBeenCalledWith(manifestPath);
        expect(mockIsAbsolute).toHaveBeenCalledWith(filtersPath);
        expect(cwdSpy).not.toHaveBeenCalled();
        expect(mockResolve).not.toHaveBeenCalled();
        expect(mockExistsSync).toHaveBeenCalledTimes(2);
        expect(mockExistsSync).toHaveBeenCalledWith(manifestPath);
        expect(mockExistsSync).toHaveBeenCalledWith(filtersPath);
        expect(mockLoader.load).toHaveBeenCalledTimes(1);
        expect(mockLoader.load).toHaveBeenCalledWith(manifestPath);
        expect(mockDirname).toHaveBeenCalledTimes(1);
        expect(mockDirname).toHaveBeenCalledWith(manifestPath);
        expect(mockReaddirSync).toHaveBeenCalledTimes(1);
        expect(mockReaddirSync).toHaveBeenCalledWith(filtersPath);
        expect(mockInjector.applyRulesets).toHaveBeenCalledTimes(1);
        expect(mockInjector.applyRulesets).toHaveBeenCalledWith(expect.any(Function), manifest, filterNames, undefined);
        expect(mockRelative).toHaveBeenCalledTimes(2);
        expect(mockRelative).toHaveBeenCalledWith(dir, `${filtersPath}/declarative/ruleset_1/ruleset_1.json`);
        expect(mockRelative).toHaveBeenCalledWith(dir, `${filtersPath}/declarative/ruleset_2/ruleset_2.json`);
        expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
        expect(mockWriteFileSync).toHaveBeenCalledWith(manifestPath, JSON.stringify({
            ...manifest,
            declarative_net_request,
        }, null, 4));
    });

    it('should apply rulesets to manifest when relative paths are provided', () => {
        const resolvedDir = 'resolved';
        const resolvedManifestPath = `${resolvedDir}/manifest.json`;
        const resolvedFiltersPath = `${resolvedDir}/resolved/filters`;

        mockDirname
            .mockReturnValueOnce(resolvedDir)
            .mockReturnValueOnce(resolvedDir);

        mockIsAbsolute
            .mockReturnValueOnce(false)
            .mockReturnValueOnce(false);

        mockResolve
            .mockReturnValueOnce(resolvedManifestPath)
            .mockReturnValueOnce(resolvedFiltersPath);

        const patcher = new ManifestPatcher(mockLoader, mockInjector);

        patcher.patch(manifestPath, filtersPath);

        expect(mockIsAbsolute).toHaveBeenCalledTimes(2);
        expect(mockIsAbsolute).toHaveBeenCalledWith(manifestPath);
        expect(mockIsAbsolute).toHaveBeenCalledWith(filtersPath);
        expect(cwdSpy).toHaveBeenCalledTimes(2);
        expect(mockResolve).toHaveBeenCalledTimes(2);
        expect(mockResolve).toHaveBeenCalledWith(cwd, manifestPath);
        expect(mockResolve).toHaveBeenCalledWith(cwd, filtersPath);
        expect(mockExistsSync).toHaveBeenCalledTimes(2);
        expect(mockExistsSync).toHaveBeenCalledWith(resolvedManifestPath);
        expect(mockExistsSync).toHaveBeenCalledWith(resolvedFiltersPath);
        expect(mockLoader.load).toHaveBeenCalledTimes(1);
        expect(mockLoader.load).toHaveBeenCalledWith(resolvedManifestPath);
        expect(mockDirname).toHaveBeenCalledTimes(1);
        expect(mockDirname).toHaveBeenCalledWith(resolvedManifestPath);
        expect(mockReaddirSync).toHaveBeenCalledTimes(1);
        expect(mockReaddirSync).toHaveBeenCalledWith(resolvedFiltersPath);
        expect(mockInjector.applyRulesets).toHaveBeenCalledTimes(1);
        expect(mockInjector.applyRulesets).toHaveBeenCalledWith(expect.any(Function), manifest, filterNames, undefined);
        expect(mockRelative).toHaveBeenCalledTimes(2);
        expect(mockRelative).toHaveBeenCalledWith(resolvedDir, `${resolvedFiltersPath}/declarative/ruleset_1/ruleset_1.json`);
        expect(mockRelative).toHaveBeenCalledWith(resolvedDir, `${resolvedFiltersPath}/declarative/ruleset_2/ruleset_2.json`);
        expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
        expect(mockWriteFileSync).toHaveBeenCalledWith(resolvedManifestPath, JSON.stringify({
            ...manifest,
            declarative_net_request,
        }, null, 4));
    });

    it('should throw an error if path is not found', () => {
        mockExistsSync.mockReturnValueOnce(false);

        const patcher = new ManifestPatcher(mockLoader, mockInjector);

        expect(() => patcher.patch(manifestPath, filtersPath)).toThrow();

        expect(mockIsAbsolute).toHaveBeenCalledTimes(1);
        expect(mockIsAbsolute).toHaveBeenCalledWith(manifestPath);
        expect(cwdSpy).not.toHaveBeenCalled();
        expect(mockResolve).not.toHaveBeenCalled();
        expect(mockExistsSync).toHaveBeenCalledTimes(1);
        expect(mockExistsSync).toHaveBeenCalledWith(manifestPath);
        expect(mockLoader.load).not.toHaveBeenCalled();
        expect(mockDirname).not.toHaveBeenCalled();
        expect(mockReaddirSync).not.toHaveBeenCalled();
        expect(mockInjector.applyRulesets).not.toHaveBeenCalled();
        expect(mockRelative).not.toHaveBeenCalled();
        expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('should throw an error if manifest cannot be loaded', () => {
        mockLoader.load.mockImplementationOnce(() => {
            throw new Error();
        });

        const patcher = new ManifestPatcher(mockLoader, mockInjector);

        expect(() => patcher.patch(manifestPath, filtersPath)).toThrow();

        expect(mockIsAbsolute).toHaveBeenCalledTimes(2);
        expect(mockIsAbsolute).toHaveBeenCalledWith(manifestPath);
        expect(mockIsAbsolute).toHaveBeenCalledWith(filtersPath);
        expect(cwdSpy).not.toHaveBeenCalled();
        expect(mockResolve).not.toHaveBeenCalled();
        expect(mockLoader.load).toHaveBeenCalledTimes(1);
        expect(mockLoader.load).toHaveBeenCalledWith(manifestPath);
        expect(mockDirname).not.toHaveBeenCalled();
        expect(mockReaddirSync).not.toHaveBeenCalled();
        expect(mockInjector.applyRulesets).not.toHaveBeenCalled();
        expect(mockRelative).not.toHaveBeenCalled();
        expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('should throw an error if filter names cannot be loaded', () => {
        mockReaddirSync.mockImplementationOnce(() => {
            throw new Error();
        });

        const patcher = new ManifestPatcher(mockLoader, mockInjector);

        expect(() => patcher.patch(manifestPath, filtersPath)).toThrow();

        expect(mockIsAbsolute).toHaveBeenCalledTimes(2);
        expect(mockIsAbsolute).toHaveBeenCalledWith(manifestPath);
        expect(mockIsAbsolute).toHaveBeenCalledWith(filtersPath);
        expect(cwdSpy).not.toHaveBeenCalled();
        expect(mockResolve).not.toHaveBeenCalled();
        expect(mockLoader.load).toHaveBeenCalledTimes(1);
        expect(mockLoader.load).toHaveBeenCalledWith(manifestPath);
        expect(mockDirname).toHaveBeenCalledTimes(1);
        expect(mockDirname).toHaveBeenCalledWith(manifestPath);
        expect(mockReaddirSync).toHaveBeenCalledTimes(1);
        expect(mockReaddirSync).toHaveBeenCalledWith(filtersPath);
        expect(mockInjector.applyRulesets).not.toHaveBeenCalled();
        expect(mockRelative).not.toHaveBeenCalled();
        expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('should throw an error if rulesets cannot be applied', () => {
        mockInjector.applyRulesets.mockImplementationOnce(() => {
            throw new Error();
        });

        const patcher = new ManifestPatcher(mockLoader, mockInjector);

        expect(() => patcher.patch(manifestPath, filtersPath)).toThrow();
        expect(mockIsAbsolute).toHaveBeenCalledTimes(2);
        expect(mockIsAbsolute).toHaveBeenCalledWith(manifestPath);
        expect(mockIsAbsolute).toHaveBeenCalledWith(filtersPath);
        expect(cwdSpy).not.toHaveBeenCalled();
        expect(mockResolve).not.toHaveBeenCalled();
        expect(mockExistsSync).toHaveBeenCalledTimes(2);
        expect(mockExistsSync).toHaveBeenCalledWith(manifestPath);
        expect(mockExistsSync).toHaveBeenCalledWith(filtersPath);
        expect(mockLoader.load).toHaveBeenCalledTimes(1);
        expect(mockLoader.load).toHaveBeenCalledWith(manifestPath);
        expect(mockDirname).toHaveBeenCalledTimes(1);
        expect(mockDirname).toHaveBeenCalledWith(manifestPath);
        expect(mockReaddirSync).toHaveBeenCalledTimes(1);
        expect(mockReaddirSync).toHaveBeenCalledWith(filtersPath);
        expect(mockInjector.applyRulesets).toHaveBeenCalledTimes(1);
        expect(mockInjector.applyRulesets).toHaveBeenCalledWith(expect.any(Function), manifest, filterNames, undefined);
        expect(mockRelative).not.toHaveBeenCalled();
        expect(mockWriteFileSync).not.toHaveBeenCalled();
    });
});
