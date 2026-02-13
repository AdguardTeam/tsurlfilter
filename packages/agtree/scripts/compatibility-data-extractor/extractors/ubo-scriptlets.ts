import * as path from 'path';
import { parse } from '@typescript-eslint/parser';

import type { Scriptlet, ScriptletParameter } from '../schema';

const UBO_RESOURCES_DIR = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '../downloads/ubo/src/js/resources',
);

/**
 * Detects getExtraArgs call and returns the starting position of extra args.
 *
 * @param funcSource - Function source code
 * @returns Starting position of extra args, or null if not found
 */
function detectExtraArgsPosition(funcSource: string): number | null {
    // Look for: safe.getExtraArgs(Array.from(arguments), N)
    const match = funcSource.match(/\.getExtraArgs\s*\(\s*[^,]+,\s*(\d+)\s*\)/);
    if (match && match[1]) {
        return parseInt(match[1], 10);
    }
    return null;
}

/**
 * Extracts parameters from a function.
 *
 * @param func - Function to extract parameters from
 * @returns Array of parameters
 */
function extractParameters(func: (...args: unknown[]) => unknown): ScriptletParameter[] {
    const funcSource = func.toString();
    const parameters: ScriptletParameter[] = [];

    // Parse function to extract parameters
    try {
        const ast = parse(funcSource, {
            sourceType: 'module',
            ecmaVersion: 'latest',
        });

        // Find function declaration or expression
        let funcNode = null;
        const [firstNode] = ast.body;
        if (firstNode?.type === 'ExpressionStatement' && firstNode.expression.type === 'FunctionExpression') {
            funcNode = firstNode.expression;
        } else if (firstNode?.type === 'FunctionDeclaration') {
            funcNode = firstNode;
        }

        if (funcNode && funcNode.params) {
            for (const param of funcNode.params) {
                // Skip rest parameters
                if (param.type === 'RestElement') {
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
                    }

                    parameters.push({
                        name: param.left.name,
                        required: false,
                        defaultValue,
                    });
                }
            }
        }
    } catch (error) {
        // Fallback: parse function string manually if AST parsing fails
        const match = funcSource.match(/^(?:async\s+)?function\s*\w*\s*\(([\s\S]*?)\)/);
        if (match && match[1]) {
            const paramsStr = match[1];
            const paramsList = paramsStr.split(',').map((p) => p.trim()).filter(Boolean);

            for (const paramStr of paramsList) {
                // Skip rest parameters (those starting with ...)
                if (paramStr.startsWith('...')) {
                    continue;
                }

                const [name, defaultVal] = paramStr.split('=').map((s) => s.trim());
                if (name) {
                    parameters.push({
                        name,
                        required: !defaultVal,
                        defaultValue: defaultVal,
                    });
                }
            }
        }
    }

    // Detect extra args position
    const extraArgsPosition = detectExtraArgsPosition(funcSource);
    if (extraArgsPosition !== null) {
        // Add extra arg parameters
        for (let i = 0; i < 3; i += 1) {
            parameters.push({
                name: `arg${extraArgsPosition + i}`,
                type: 'string',
                required: false,
            });
        }
    }

    return parameters;
}

/**
 * Extracts all uBlock Origin scriptlets by importing scriptlets.js.
 *
 * @returns Array of all extracted uBlock scriptlets
 */
export async function extractUboScriptlets(): Promise<Scriptlet[]> {
    console.log('Extracting uBlock Origin scriptlets...');

    const scriptletsFilePath = path.join(UBO_RESOURCES_DIR, 'scriptlets.js');

    // Dynamically import the scriptlets module
    const { builtinScriptlets } = await import(scriptletsFilePath);

    if (!Array.isArray(builtinScriptlets)) {
        throw new Error('builtinScriptlets is not an array');
    }

    const allScriptlets: Scriptlet[] = [];

    // Build a map of all scriptlets by name for dependency lookup
    const scriptletMap = new Map();
    for (const scriptlet of builtinScriptlets) {
        if (scriptlet.name) {
            scriptletMap.set(scriptlet.name, scriptlet);
        }
    }

    for (const scriptlet of builtinScriptlets) {
        const {
            name, fn:
            func,
            aliases: scriptletAliases,
            world,
            dependencies,
        } = scriptlet;

        // Only include scriptlets with names ending in .js
        if (!name || !name.endsWith('.js')) {
            continue;
        }

        let parameters: ScriptletParameter[] | undefined;

        // If scriptlet has dependencies, check if there's a matching .fn dependency
        // that represents the actual implementation (e.g., abort-current-script.fn for abort-current-script.js)
        let functionToExtract = func;
        if (dependencies && Array.isArray(dependencies)) {
            // Get the base name without .js extension
            const baseName = name.replace(/\.js$/, '');
            // Look for a dependency that matches: baseName + '.fn'
            const matchingDep = `${baseName}.fn`;

            if (dependencies.includes(matchingDep)) {
                const depScriptlet = scriptletMap.get(matchingDep);
                if (depScriptlet && typeof depScriptlet.fn === 'function') {
                    functionToExtract = depScriptlet.fn;
                }
            }
        }

        if (typeof functionToExtract === 'function') {
            parameters = extractParameters(functionToExtract);
            if (parameters.length === 0) {
                parameters = undefined;
            }
        }

        // Determine context based on world property
        const context = world === 'ISOLATED' ? ['isolated'] : ['main'];

        // Build complete aliases array
        const allAliases: string[] = [];

        // Add base name without .js
        const baseName = name.replace(/\.js$/, '');
        allAliases.push(baseName);

        // Add all original aliases and their .js-stripped versions
        if (scriptletAliases) {
            for (const alias of scriptletAliases) {
                allAliases.push(alias);
                // Also add version without .js if it ends with .js
                if (alias.endsWith('.js')) {
                    const aliasWithoutJs = alias.replace(/\.js$/, '');
                    if (!allAliases.includes(aliasWithoutJs)) {
                        allAliases.push(aliasWithoutJs);
                    }
                }
            }
        }

        allScriptlets.push({
            name,
            aliases: allAliases.length > 0 ? allAliases : undefined,
            context,
            parameters,
        });
    }

    console.log(`Extracted ${allScriptlets.length} uBlock Origin scriptlets`);

    // Sort alphabetically by name
    allScriptlets.sort((a, b) => a.name.localeCompare(b.name));

    return allScriptlets;
}
