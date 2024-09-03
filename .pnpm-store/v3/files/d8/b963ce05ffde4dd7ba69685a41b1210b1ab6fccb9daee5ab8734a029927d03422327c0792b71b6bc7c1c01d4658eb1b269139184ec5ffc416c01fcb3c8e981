import { IValueListModifier } from './value-list-modifier';

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
 * Learn more about it here:
 * https://adguard.com/kb/general/ad-filtering/create-own-filters/#method-modifier
 */
export class MethodModifier implements IValueListModifier<HTTPMethod> {
    /**
     * Request methods separator
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

    /**
     * Constructor
     *
     * @param value
     */
    constructor(methodsStr: string) {
        if (methodsStr === '') {
            throw new SyntaxError('$method modifier value cannot be empty');
        }

        const permittedMethods: HTTPMethod[] = [];
        const restrictedMethods: HTTPMethod[] = [];

        const parts = methodsStr.toUpperCase().split(MethodModifier.PIPE_SEPARATOR);
        for (let i = 0; i < parts.length; i += 1) {
            let method = parts[i].trim();
            let restricted = false;
            if (method.startsWith('~')) {
                restricted = true;
                method = method.substring(1);
            }

            if (!MethodModifier.isHTTPMethod(method)) {
                throw new SyntaxError(`Invalid $method modifier value: ${method}`);
            }

            if (restricted) {
                restrictedMethods.push(method);
            } else {
                permittedMethods.push(method);
            }
        }

        if (restrictedMethods.length > 0 && permittedMethods.length > 0) {
            throw new SyntaxError(`Negated values cannot be mixed with non-negated values: ${methodsStr}`);
        }

        this.restrictedValues = restrictedMethods.length > 0 ? restrictedMethods : null;
        this.permittedValues = permittedMethods.length > 0 ? permittedMethods : null;
    }

    public static isHTTPMethod = (value: string): value is HTTPMethod => value in HTTPMethod;
}
