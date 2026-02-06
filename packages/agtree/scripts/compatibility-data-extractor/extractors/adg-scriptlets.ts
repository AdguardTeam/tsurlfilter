/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'fs/promises';
import * as path from 'path';
import { parse } from '@typescript-eslint/parser';
import { parse as parseJsdoc } from 'comment-parser';

import type { Scriptlet, ScriptletParameter } from '../schema';

const ADG_SOURCE_DIR = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '../downloads/adg-scriptlets/src/scriptlets',
);

/**
 * Cleans up version string by removing leading 'v' and trailing '.'.
 *
 * @param rawVersion - Raw version string
 * @returns Cleaned version string
 */
function cleanVersion(rawVersion: string): string {
    let version = rawVersion.trim();
    if (version.startsWith('v')) {
        version = version.slice(1);
    }
    if (version.endsWith('.')) {
        version = version.slice(0, -1);
    }
    return version;
}

/**
 * Extracts parameters from function AST node.
 *
 * @param func - Function AST node
 * @returns Array of parameters
 */
function extractParameters(func: any): ScriptletParameter[] {
    const parameters: ScriptletParameter[] = [];

    for (const param of func.params) {
        // Skip 'source' parameter (AdGuard internal parameter)
        if (param.type === 'Identifier' && param.name === 'source') {
            continue;
        }

        if (param.type === 'Identifier') {
            parameters.push({
                name: param.name,
                required: true,
            });
        } else if (param.type === 'AssignmentPattern' && param.left.type === 'Identifier') {
            let defaultValue: string | undefined;

            if (param.right.type === 'Literal') {
                defaultValue = param.right.value === null ? 'null' : String(param.right.value);
            } else if (param.right.type === 'Identifier') {
                defaultValue = param.right.name;
            } else if (param.right.type === 'UnaryExpression' && param.right.argument.type === 'Literal') {
                defaultValue = String(param.right.argument.value);
            }

            parameters.push({
                name: param.left.name,
                required: false,
                defaultValue,
            });
        } else if (param.type === 'RestElement' && param.argument.type === 'Identifier') {
            parameters.push({
                name: param.argument.name,
                type: '...string',
                required: false,
            });
        }
    }

    return parameters;
}

/**
 * Parses JSDoc comment and extracts scriptlet metadata.
 *
 * @param jsdocComment - JSDoc comment text
 * @returns Parsed metadata
 */
function parseScriptletJSDoc(jsdocComment: string) {
    const parsed = parseJsdoc(jsdocComment);
    let scriptletName: string | undefined;
    let description: string | undefined;
    let since: string | undefined;
    const aliases: string[] = [];
    const params = new Map<string, { type?: string; description?: string }>();

    if (parsed.length > 0) {
        const block = parsed[0];

        if (block.description) {
            description = block.description.trim();
        }

        for (const tag of block.tags) {
            if (tag.tag === 'scriptlet' || tag.tag === 'trustedScriptlet') {
                scriptletName = tag.name || tag.description.trim();
            } else if (tag.tag === 'description') {
                const parts = [tag.name, tag.description].filter(Boolean).join(' ');
                description = parts.trim();
            } else if (tag.tag === 'added') {
                const rawVersion = tag.name || tag.description.trim();
                since = cleanVersion(rawVersion);
            } else if (tag.tag === 'alias') {
                const alias = tag.name || tag.description.trim();
                if (alias) {
                    aliases.push(alias);
                }
            } else if (tag.tag === 'param') {
                params.set(tag.name, {
                    type: tag.type,
                    description: tag.description.trim(),
                });
            }
        }
    }

    return {
        scriptletName,
        description,
        since,
        aliases,
        params,
    };
}

/**
 * Finds JSDoc comment before a node that contains @scriptlet or @trustedScriptlet tag.
 *
 * @param comments - Array of comments from AST
 * @param node - Node to find comment for
 * @returns JSDoc comment text or undefined
 */
function findScriptletJSDoc(comments: any[] | undefined, node: any): string | undefined {
    if (!comments || !node.range) {
        return undefined;
    }

    for (let i = comments.length - 1; i >= 0; i -= 1) {
        const comment = comments[i];
        if (
            comment.type === 'Block'
            && comment.value.startsWith('*')
            && comment.range
            && comment.range[1] < node.range[0]
        ) {
            const commentText = `/*${comment.value}*/`;
            if (/@(scriptlet|trustedScriptlet)\b/.test(commentText)) {
                return commentText;
            }
        }
    }

    return undefined;
}

/**
 * Merges aliases from const array with existing aliases.
 *
 * @param aliasesFromArray - Aliases extracted from const array
 * @param existingAliases - Existing aliases from JSDoc
 * @param currentScriptletName - Current scriptlet name
 * @returns Updated scriptlet name and merged aliases
 */
function mergeAliases(
    aliasesFromArray: string[],
    existingAliases: string[],
    currentScriptletName?: string,
): { scriptletName?: string; aliases: string[] } {
    const aliases = [...existingAliases];
    let scriptletName = currentScriptletName;

    if (aliasesFromArray.length > 0) {
        const primaryName = aliasesFromArray[0];
        const arrayAliases = aliasesFromArray.slice(1);

        if (!scriptletName) {
            scriptletName = primaryName;
        }

        for (const alias of arrayAliases) {
            if (!aliases.includes(alias)) {
                aliases.push(alias);
            }
        }
    }

    return { scriptletName, aliases };
}

/**
 * Extracts scriptlet metadata from a single AdGuard scriptlet file.
 *
 * @param filePath - Path to the JavaScript file
 * @param exportedName - The name used in the export statement
 * @returns Extracted scriptlet or null if not found
 */
async function extractFromFile(filePath: string, exportedName: string): Promise<Scriptlet | null> {
    const code = await fs.readFile(filePath, 'utf-8');

    // Parse the JavaScript code
    const ast = parse(code, {
        sourceType: 'module',
        ecmaVersion: 'latest',
        comment: true,
        loc: true,
        range: true,
    });

    // First, look for exported const array with aliases (e.g., abortOnPropertyReadNames)
    const aliasesArrayName = `${exportedName}Names`;
    const aliasesFromArray: string[] = [];

    for (const node of ast.body) {
        if (
            node.type === 'ExportNamedDeclaration'
            && node.declaration?.type === 'VariableDeclaration'
        ) {
            for (const declarator of node.declaration.declarations) {
                if (
                    declarator.type === 'VariableDeclarator'
                    && declarator.id.type === 'Identifier'
                    && declarator.id.name === aliasesArrayName
                    && declarator.init?.type === 'ArrayExpression'
                ) {
                    // Extract string literals from array
                    for (const element of declarator.init.elements) {
                        if (element?.type === 'Literal' && typeof element.value === 'string') {
                            aliasesFromArray.push(element.value);
                        }
                    }
                }
            }
        }
    }

    // Find the exported function or re-export by name
    for (const node of ast.body) {
        // Handle function declarations
        if (
            node.type === 'ExportNamedDeclaration'
            && node.declaration?.type === 'FunctionDeclaration'
            && node.declaration.id?.name === exportedName
        ) {
            const func = node.declaration;

            // Extract parameters from function signature
            const parameters = extractParameters(func);

            // Find JSDoc comment
            const jsdocComment = findScriptletJSDoc(ast.comments, func);

            let scriptletName: string | undefined;
            let description: string | undefined;
            let since: string | undefined;
            let aliases: string[] = [];
            let jsdocParams = new Map<string, { type?: string; description?: string }>();

            // Parse JSDoc if found
            if (jsdocComment) {
                const jsdocData = parseScriptletJSDoc(jsdocComment);
                scriptletName = jsdocData.scriptletName;
                description = jsdocData.description;
                since = jsdocData.since;
                aliases = jsdocData.aliases;
                jsdocParams = jsdocData.params;
            }

            // Fallback to file name if scriptlet name not found in JSDoc
            if (!scriptletName) {
                const baseName = path.basename(filePath);
                scriptletName = baseName.replace(/\.(js|ts)$/, '');
            }

            // Merge aliases from const array
            const merged = mergeAliases(aliasesFromArray, aliases, scriptletName);
            scriptletName = merged.scriptletName;
            aliases = merged.aliases;

            // Merge JSDoc parameter info with actual parameters
            for (const param of parameters) {
                const jsdocParam = jsdocParams.get(param.name);
                if (jsdocParam) {
                    if (jsdocParam.type && !param.type) {
                        // Remove leading ? from type since required field indicates optionality
                        param.type = jsdocParam.type.replace(/^\?/, '');
                    }
                    if (jsdocParam.description && !param.description) {
                        param.description = jsdocParam.description;
                    }
                }
            }

            return {
                name: scriptletName!,
                aliases: aliases.length > 0 ? aliases : undefined,
                context: ['main'],
                description,
                parameters,
                since,
            };
        }

        // Handle re-exports (export { ... }) with @scriptlet JSDoc
        if (
            node.type === 'ExportNamedDeclaration'
            && !node.declaration
            && node.specifiers
        ) {
            // Check if any specifier matches the exported name
            const hasMatchingSpecifier = node.specifiers.some(
                (spec) => spec.type === 'ExportSpecifier' && spec.exported.name === exportedName,
            );

            if (hasMatchingSpecifier) {
                const jsdocComment = findScriptletJSDoc(ast.comments, node);

                if (jsdocComment) {
                    const jsdocData = parseScriptletJSDoc(jsdocComment);
                    let { scriptletName } = jsdocData;
                    const { description } = jsdocData;
                    const { since } = jsdocData;
                    let { aliases } = jsdocData;

                    // Fallback to file name if not found
                    if (!scriptletName) {
                        const baseName = path.basename(filePath);
                        scriptletName = baseName.replace(/\.(js|ts)$/, '');
                    }

                    // Merge with aliases from array
                    const merged = mergeAliases(aliasesFromArray, aliases, scriptletName);
                    scriptletName = merged.scriptletName;
                    aliases = merged.aliases;

                    return {
                        name: scriptletName!,
                        aliases: aliases.length > 0 ? aliases : undefined,
                        context: ['main'],
                        description,
                        parameters: undefined,
                        since,
                    };
                }
            }
        }
    }

    return null;
}

/**
 * Parses scriptlets-list.ts to get all exported scriptlet names and their file paths.
 *
 * @returns Map of export name to file path
 */
async function parseScriptletsList(): Promise<Map<string, string>> {
    const listPath = path.join(ADG_SOURCE_DIR, 'scriptlets-list.ts');
    const code = await fs.readFile(listPath, 'utf-8');

    const ast = parse(code, {
        sourceType: 'module',
        ecmaVersion: 'latest',
    });

    const exports = new Map<string, string>();

    for (const node of ast.body) {
        if (node.type === 'ExportNamedDeclaration' && node.source) {
            // export { functionName } from './file-name';
            if (node.specifiers) {
                for (const specifier of node.specifiers) {
                    if (specifier.type === 'ExportSpecifier') {
                        const exportedName = specifier.exported.name;
                        const sourcePath = node.source.value;
                        // Remove ./ and add .js extension
                        const fileName = `${sourcePath.replace(/^\.\//, '')}.js`;
                        exports.set(exportedName, fileName);
                    }
                }
            }
        }
    }

    return exports;
}

/**
 * Extracts all AdGuard scriptlets from the source directory.
 *
 * @returns Array of all extracted AdGuard scriptlets
 */
export async function extractAdgScriptlets(): Promise<Scriptlet[]> {
    console.log('Extracting AdGuard scriptlets...');

    const scriptletsList = await parseScriptletsList();
    const allScriptlets: Scriptlet[] = [];

    for (const [exportedName, fileName] of scriptletsList) {
        // Try .js first, then .ts if .js doesn't exist
        const jsPath = path.join(ADG_SOURCE_DIR, fileName);
        const tsPath = path.join(ADG_SOURCE_DIR, fileName.replace(/\.js$/, '.ts'));

        let filePath = jsPath;
        try {
            await fs.access(jsPath);
        } catch {
            // .js doesn't exist, try .ts
            filePath = tsPath;
        }

        try {
            const scriptlet = await extractFromFile(filePath, exportedName);
            if (scriptlet) {
                allScriptlets.push(scriptlet);
            }
        } catch (error) {
            // Silently skip files that don't exist or can't be parsed
        }
    }

    console.log(`Extracted ${allScriptlets.length} AdGuard scriptlets`);

    // Sort alphabetically by name
    allScriptlets.sort((a, b) => a.name.localeCompare(b.name));

    return allScriptlets;
}
