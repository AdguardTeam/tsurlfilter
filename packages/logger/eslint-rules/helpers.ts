import type { Rule } from 'eslint';

/**
 * Traverses up the AST to find enclosing class, method, and function names.
 *
 * @param node The AST node to start from.
 *
 * @returns An object containing the class, method, and function names (or null if not found).
 */
export const getEnclosingNames = (
    node: any,
): {
    className: string | null;
    methodName: string | null;
    functionName: string | null;
} => {
    let className: string | null = null;
    let methodName: string | null = null;
    let functionName: string | null = null;
    let { parent } = node;
    while (parent) {
        if (!className && parent.type === 'ClassDeclaration' && parent.id) {
            className = parent.id.name;
        }
        if (!methodName && parent.type === 'MethodDefinition' && parent.key) {
            methodName = parent.key.name;
        }
        if (
            !functionName
            && (parent.type === 'FunctionDeclaration' || parent.type === 'FunctionExpression')
            && parent.id
        ) {
            functionName = parent.id.name;
        }
        parent = parent.parent;
    }
    return {
        className,
        methodName,
        functionName,
    };
};

/**
 * Builds the logger context tag based on available names.
 *
 * @param contextModuleName The logger context module name.
 * @param fileName The file name.
 * @param className The class name (or null).
 * @param methodName The method name (or null).
 *
 * @returns The tag string.
 */
export const buildTag = (
    contextModuleName: string,
    fileName: string,
    className: string | null,
    methodName: string | null,
): string => {
    if (!className) {
        return `[${contextModuleName}.${fileName}]:`;
    }
    if (className && methodName) {
        return `[${contextModuleName}.${className}.${methodName}]:`;
    }
    if (className) {
        return `[${contextModuleName}.${className}]:`;
    }
    return `[${contextModuleName}]:`;
};

/**
 * Checks if a string, template, or binary expression starts with the given tag.
 *
 * @param arg The AST argument node.
 * @param tag The tag string to check for.
 *
 * @returns True if the argument starts with the tag, otherwise false.
 */
export const startsWithTag = (arg: any, tag: string): boolean => {
    if (!arg) {
        return false;
    }
    if (arg.type === 'Literal' && typeof arg.value === 'string') {
        return arg.value.startsWith(tag);
    }
    if (arg.type === 'TemplateLiteral' && arg.quasis.length > 0) {
        return arg.quasis[0].value.raw.startsWith(tag);
    }
    if (arg.type === 'BinaryExpression' && arg.operator === '+') {
        if (arg.left.type === 'Literal' && typeof arg.left.value === 'string') {
            return arg.left.value.startsWith(tag);
        }
        if (arg.left.type === 'TemplateLiteral' && arg.left.quasis.length > 0) {
            return arg.left.quasis[0].value.raw.startsWith(tag);
        }
    }
    return false;
};

/**
 * Creates the fixer function for context tag violations.
 *
 * @param context The ESLint rule context.
 * @param node The AST CallExpression node.
 * @param tag The tag string to enforce.
 *
 * @returns A fixer function that returns a Rule.Fix or null.
 */
export const createFix = (
    context: Rule.RuleContext,
    node: any,
    tag: string,
): ((fixer: any) => Rule.Fix | null) => {
    const { arguments: args } = node;
    const firstArg = args[0];
    return (fixer: any): Rule.Fix | null => {
        const sourceCode = context.getSourceCode();
        if (firstArg && firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
            const cleaned = firstArg.value.replace(/^\[[^\]]+\](?::)?\s*/, '');
            return fixer.replaceText(firstArg, `'${tag} ${cleaned}'`);
        }
        if (firstArg && firstArg.type === 'TemplateLiteral' && firstArg.quasis.length > 0) {
            const quasiRaw = firstArg.quasis[0].value.raw;
            const rest = quasiRaw.replace(/^\[[^\]]+\](?::)?\s*/, '');
            const newQuasi = `${tag} ${rest}`;
            let rebuilt = `\`${newQuasi}`;
            for (let i = 0; i < firstArg.expressions.length; i += 1) {
                const expr = firstArg.expressions[i];
                const exprSource = sourceCode.getText(expr);
                const quasi = firstArg.quasis[i + 1]
                    ? firstArg.quasis[i + 1].value.raw
                    : '';
                rebuilt += `\${${exprSource}}${quasi}`;
            }
            rebuilt += '`';
            return fixer.replaceText(firstArg, rebuilt);
        }
        if (!firstArg) {
            return fixer.insertTextAfter(node.callee, `('${tag} ')`);
        }
        return null;
    };
};
