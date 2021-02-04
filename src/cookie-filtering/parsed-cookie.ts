/**
 * Cookie parsed from headers
 */
export default class ParsedCookie {
    name: string;

    value: string;

    expires?: Date;

    maxAge?: number;

    secure?: boolean;

    httpOnly?: boolean;

    sameSite?: string;

    thirdParty = false;

    constructor(name: string, value: string) {
        this.name = name;
        this.value = value;
    }
}
