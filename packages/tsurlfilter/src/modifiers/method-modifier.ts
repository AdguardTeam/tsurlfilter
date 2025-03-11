import { type MethodList, MethodListParser, type ModifierValue } from '@adguard/agtree';
import { ListItemsGenerator } from '@adguard/agtree/generator';
import { type IValueListModifier } from './value-list-modifier';
import { isString } from '../utils/string-utils';

export enum HTTPMethod {
    GET = 'GET',
    POST = 'POST',
    PUT = 'PUT',
    DELETE = 'DELETE',
    PATCH = 'PATCH',
    HEAD = 'HEAD',
    OPTIONS = 'OPTIONS',
    CONNECT = 'CONNECT',
    TRACE = 'TRACE',
}

/**
 * Method modifier class.
 * Rules with $method modifier will be applied only to requests with specified methods.
 *
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#method-modifier}
 */
export class MethodModifier implements IValueListModifier<HTTPMethod> {
    /**
     * Request methods separator.
     */
    private static PIPE_SEPARATOR = '|';

    /**
     * List of permitted methods or null.
     */
    public readonly permittedValues: HTTPMethod[] | null;

    /**
     * List of restricted methods or null.
     */
    public readonly restrictedValues: HTTPMethod[] | null;

    private static getMethodListNode = (methods: string | ModifierValue): MethodList => {
        if (isString(methods)) {
            if (!methods) {
                throw new Error('Method list cannot be empty');
            }

            return MethodListParser.parse(methods);
        }

        if (methods.type !== 'MethodList') {
            throw new Error('Unsupported modifier value type');
        }

        if (methods.children.length === 0) {
            throw new Error('Method list cannot be empty');
        }

        return methods;
    };

    /**
     * Constructor.
     *
     * @param methods Value of the modifier.
     */
    constructor(methods: string | ModifierValue) {
        const permittedMethods: HTTPMethod[] = [];
        const restrictedMethods: HTTPMethod[] = [];

        const methodListNode = MethodModifier.getMethodListNode(methods);

        methodListNode.children.forEach((methodNode) => {
            const upperCaseValue = methodNode.value.toUpperCase();

            if (!MethodModifier.isHTTPMethod(upperCaseValue)) {
                throw new SyntaxError(`Invalid $method modifier value: ${upperCaseValue}`);
            }

            if (methodNode.exception) {
                restrictedMethods.push(upperCaseValue);
            } else {
                permittedMethods.push(upperCaseValue);
            }
        });

        if (restrictedMethods.length > 0 && permittedMethods.length > 0) {
            // eslint-disable-next-line max-len
            throw new SyntaxError(`Negated values cannot be mixed with non-negated values: ${ListItemsGenerator.generate(methodListNode.children, MethodModifier.PIPE_SEPARATOR)}`);
        }

        this.restrictedValues = restrictedMethods.length > 0 ? restrictedMethods : null;
        this.permittedValues = permittedMethods.length > 0 ? permittedMethods : null;
    }

    public static isHTTPMethod = (value: string): value is HTTPMethod => value in HTTPMethod;
}
