import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { copy } from 'fs-extra';
import process from 'process';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { LocalScriptRulesJs } from '../../../src/common/localScriptRulesJs';
import { LocalScriptRulesJson } from '../../../src/common/localScriptRulesJson';
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

describe('extendLocalScriptRulesJs', () => {
    let tempDir: string;
    let testFilePath: string;
    let loader: AssetsLoader;

    beforeEach(async () => {
        // Create a temporary directory for test files
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'loader-test-js-'));
        testFilePath = path.join(tempDir, LocalScriptRulesJs.FILENAME);
        loader = new AssetsLoader();
    });

    afterEach(async () => {
        // Clean up temporary files
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should extend existing rules with new JS rules', async () => {
        // Create initial file with one rule
        const initialRules = new Set(['console.log("existing");']);
        const handler = new LocalScriptRulesJs();
        const initialContent = await handler.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with new rule
        const customRules = ['example.com#%#console.log("new");'];
        await loader.extendLocalScriptRulesJs(testFilePath, customRules);

        // Verify the file contains both rules
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');
        const updatedRules = await handler.deserialize(updatedContent);

        expect(updatedRules.size).toBe(2);
        expect(updatedRules.has('console.log("existing");')).toBe(true);
        expect(updatedRules.has('console.log("new");')).toBe(true);
    });

    it('should not add duplicate rules', async () => {
        // Create initial file with one rule
        const initialRules = new Set(['console.log("test");']);
        const handler = new LocalScriptRulesJs();
        const initialContent = await handler.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Try to extend with the same rule
        const customRules = ['example.com#%#console.log("test");'];
        await loader.extendLocalScriptRulesJs(testFilePath, customRules);

        // Verify the file still contains only one rule
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');
        const updatedRules = await handler.deserialize(updatedContent);

        expect(updatedRules.size).toBe(1);
        expect(updatedRules.has('console.log("test");')).toBe(true);
    });

    it('should handle empty custom rules array', async () => {
        // Create initial file with one rule
        const initialRules = new Set(['console.log("existing");']);
        const handler = new LocalScriptRulesJs();
        const initialContent = await handler.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with empty array
        const customRules: string[] = [];
        await loader.extendLocalScriptRulesJs(testFilePath, customRules);

        // Verify the file is unchanged
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');
        expect(updatedContent).toBe(initialContent);
    });

    it('should handle custom rules with no JS injection rules', async () => {
        // Create initial file with one rule
        const initialRules = new Set(['console.log("existing");']);
        const handler = new LocalScriptRulesJs();
        const initialContent = await handler.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with rules that are not JS injection rules
        const customRules = [
            'example.com##.ad',
            '||example.com^',
            'example.com##+js(scriptlet, arg)',
        ];
        await loader.extendLocalScriptRulesJs(testFilePath, customRules);

        // Verify the file is unchanged
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');
        expect(updatedContent).toBe(initialContent);
    });

    it('should skip invalid JS rules and keep valid ones', async () => {
        // Create initial file
        const initialRules = new Set(['console.log("existing");']);
        const handler = new LocalScriptRulesJs();
        const initialContent = await handler.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with mix of valid and invalid rules
        const customRules = [
            'example.com#%#console.log("valid");',
            'example.com#%#invalid syntax {{{',
            'example.com#%#alert("another valid");',
        ];
        await loader.extendLocalScriptRulesJs(testFilePath, customRules);

        // Verify only valid rules were added
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');
        const updatedRules = await handler.deserialize(updatedContent);

        expect(updatedRules.size).toBe(3);
        expect(updatedRules.has('console.log("existing");')).toBe(true);
        expect(updatedRules.has('console.log("valid");')).toBe(true);
        expect(updatedRules.has('alert("another valid");')).toBe(true);
    });

    it('should handle multiple new rules', async () => {
        // Create initial file
        const initialRules = new Set(['console.log("existing");']);
        const handler = new LocalScriptRulesJs();
        const initialContent = await handler.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with multiple rules
        const customRules = [
            'example.com#%#console.log("rule1");',
            'test.com#%#console.log("rule2");',
            'site.org#%#alert("rule3");',
        ];
        await loader.extendLocalScriptRulesJs(testFilePath, customRules);

        // Verify all rules were added
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');
        const updatedRules = await handler.deserialize(updatedContent);

        expect(updatedRules.size).toBe(4);
        expect(updatedRules.has('console.log("existing");')).toBe(true);
        expect(updatedRules.has('console.log("rule1");')).toBe(true);
        expect(updatedRules.has('console.log("rule2");')).toBe(true);
        expect(updatedRules.has('alert("rule3");')).toBe(true);
    });

    it('should preserve existing rules with special characters when extending', async () => {
        // Create initial file with rules containing special characters like quotes and backslashes
        // The serializeWithExisting method should preserve these without double-escaping
        const initialRules = new Set([
            'console.log("test with \\"quotes\\"");',
            'console.log("backslash: \\\\");',
            'console.log("newline: \\n");',
        ]);
        const handler = new LocalScriptRulesJs();
        const initialContent = await handler.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with new custom rules
        const customRules = [
            'example.com#%#console.log("new custom rule");',
            'test.com#%#alert("another custom rule");',
        ];
        await loader.extendLocalScriptRulesJs(testFilePath, customRules);

        // Verify all rules are present
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');
        const updatedRules = await handler.deserialize(updatedContent);

        expect(updatedRules.size).toBe(5);

        // Verify existing rules with special characters are preserved exactly
        expect(updatedRules.has('console.log("test with \\"quotes\\"");')).toBe(true);
        expect(updatedRules.has('console.log("backslash: \\\\");')).toBe(true);
        expect(updatedRules.has('console.log("newline: \\n");')).toBe(true);

        // Verify new custom rules were added
        expect(updatedRules.has('console.log("new custom rule");')).toBe(true);
        expect(updatedRules.has('alert("another custom rule");')).toBe(true);

        // Verify the file is valid and can be parsed
        // FIXME: Check thi
        expect(() => handler.deserialize(updatedContent)).not.toThrow();
    });
});

describe('extendLocalScriptRulesJson', () => {
    let tempDir: string;
    let testFilePath: string;
    let loader: AssetsLoader;

    beforeEach(async () => {
        // Create a temporary directory for test files
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'loader-test-json-'));
        testFilePath = path.join(tempDir, LocalScriptRulesJson.FILENAME);
        loader = new AssetsLoader();
    });

    afterEach(async () => {
        // Clean up temporary files
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should extend existing rules with new JS rules and domain configs', async () => {
        // Create initial file with one rule
        const initialRules = new Map([
            ['console.log("existing");', [{ permittedDomains: ['example.com'], restrictedDomains: [] }]],
        ]);
        const handler = new LocalScriptRulesJson();
        const initialContent = handler.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with new rule
        const customRules = ['test.com#%#console.log("new");'];
        await loader.extendLocalScriptRulesJson(testFilePath, customRules);

        // Verify the file contains both rules
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');
        const updatedRules = handler.deserialize(updatedContent);

        expect(updatedRules.size).toBe(2);
        expect(updatedRules.has('console.log("existing");')).toBe(true);
        expect(updatedRules.has('console.log("new");')).toBe(true);

        const newRuleConfigs = updatedRules.get('console.log("new");');
        expect(newRuleConfigs).toBeDefined();
        expect(newRuleConfigs).toHaveLength(1);
        expect(newRuleConfigs![0].permittedDomains).toContain('test.com');
    });

    it('should merge domain configs for the same script body', async () => {
        // Create initial file with one rule
        const initialRules = new Map([[
            'console.log("test");',
            [{ permittedDomains: ['example.com'], restrictedDomains: [] }],
        ]]);
        const handler = new LocalScriptRulesJson();
        const initialContent = handler.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with the same script body but different domain
        const customRules = ['test.com#%#console.log("test");'];
        await loader.extendLocalScriptRulesJson(testFilePath, customRules);

        // Verify the file contains one rule with two domain configs
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');
        const updatedRules = handler.deserialize(updatedContent);

        expect(updatedRules.size).toBe(1);
        const configs = updatedRules.get('console.log("test");');
        expect(configs).toBeDefined();
        expect(configs).toHaveLength(2);
        expect(configs![0].permittedDomains).toContain('example.com');
        expect(configs![1].permittedDomains).toContain('test.com');
    });

    it('should not duplicate domain configs', async () => {
        // Create initial file with one rule
        const initialRules = new Map([[
            'console.log("test");',
            [{ permittedDomains: ['example.com'], restrictedDomains: [] }],
        ]]);
        const handler = new LocalScriptRulesJson();
        const initialContent = handler.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with the same rule and domain
        const customRules = ['example.com#%#console.log("test");'];
        await loader.extendLocalScriptRulesJson(testFilePath, customRules);

        // Verify the file still contains only one domain config
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');
        const updatedRules = handler.deserialize(updatedContent);

        expect(updatedRules.size).toBe(1);
        const configs = updatedRules.get('console.log("test");');
        expect(configs).toBeDefined();
        expect(configs).toHaveLength(1);
    });

    it('should handle rules with restricted domains', async () => {
        // Create initial file
        const initialRules = new Map([[
            'console.log("existing");',
            [{ permittedDomains: ['example.com'], restrictedDomains: [] }],
        ]]);
        const handler = new LocalScriptRulesJson();
        const initialContent = handler.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with rule that has restricted domain
        const customRules = ['example.com,~sub.example.com#%#console.log("new");'];
        await loader.extendLocalScriptRulesJson(testFilePath, customRules);

        // Verify the domain config is correct
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');
        const updatedRules = handler.deserialize(updatedContent);

        const newRuleConfigs = updatedRules.get('console.log("new");');
        expect(newRuleConfigs).toBeDefined();
        expect(newRuleConfigs).toHaveLength(1);
        expect(newRuleConfigs![0].permittedDomains).toContain('example.com');
        expect(newRuleConfigs![0].restrictedDomains).toContain('sub.example.com');
    });

    it('should handle empty custom rules array', async () => {
        // Create initial file
        const initialRules = new Map([[
            'console.log("existing");',
            [{ permittedDomains: ['example.com'], restrictedDomains: [] }],
        ]]);
        const handler = new LocalScriptRulesJson();
        const initialContent = handler.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with empty array
        const customRules: string[] = [];
        await loader.extendLocalScriptRulesJson(testFilePath, customRules);

        // Verify the file is unchanged
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');
        expect(updatedContent).toBe(initialContent);
    });

    it('should handle custom rules with no JS injection rules', async () => {
        // Create initial file
        const initialRules = new Map([[
            'console.log("existing");',
            [{ permittedDomains: ['example.com'], restrictedDomains: [] }],
        ]]);
        const handler = new LocalScriptRulesJson();
        const initialContent = handler.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with non-JS rules
        const customRules = [
            'example.com##.ad',
            '||example.com^',
            'example.com##+js(scriptlet, arg)',
        ];
        await loader.extendLocalScriptRulesJson(testFilePath, customRules);

        // Verify the file is unchanged
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');
        expect(updatedContent).toBe(initialContent);
    });

    it('should handle multiple rules with different domains', async () => {
        // Create initial file
        const initialRules = new Map([[
            'console.log("existing");',
            [{ permittedDomains: ['example.com'], restrictedDomains: [] }],
        ]]);
        const handler = new LocalScriptRulesJson();
        const initialContent = handler.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with multiple rules
        const customRules = [
            'test.com#%#console.log("rule1");',
            'site.org,another.org#%#console.log("rule2");',
            'example.com,~sub.example.com#%#alert("rule3");',
        ];
        await loader.extendLocalScriptRulesJson(testFilePath, customRules);

        // Verify all rules were added with correct domain configs
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');
        const updatedRules = handler.deserialize(updatedContent);

        expect(updatedRules.size).toBe(4);

        const rule2Configs = updatedRules.get('console.log("rule2");');
        expect(rule2Configs).toBeDefined();
        expect(rule2Configs![0].permittedDomains).toHaveLength(2);
        expect(rule2Configs![0].permittedDomains).toContain('site.org');
        expect(rule2Configs![0].permittedDomains).toContain('another.org');
    });
});
