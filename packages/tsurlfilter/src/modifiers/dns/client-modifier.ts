// eslint-disable-next-line max-classes-per-file
import isCidr from 'is-cidr';
import isIp from 'is-ip';
import { contains } from 'cidr-tools';
import { BaseValuesModifier } from '../values-modifier';

/**
 * Netmasks class
 */
class NetmasksCollection {
    ipv4Masks: string[] = [];

    ipv6Masks: string[] = [];

    /**
     * Returns true if any of the containing masks contains provided value
     *
     * @param value
     */
    contains(value: string): boolean {
        if (isIp.v4(value)) {
            return this.ipv4Masks.some((x) => contains(x, value));
        }

        return this.ipv6Masks.some((x) => contains(x, value));
    }
}

/**
 * The client modifier allows specifying clients this rule will be working for.
 * It accepts client names (not ClientIDs), IP addresses, or CIDR ranges.
 */
export class ClientModifier extends BaseValuesModifier {
    private readonly permittedNetmasks: NetmasksCollection | undefined;

    private readonly restrictedNetmasks: NetmasksCollection | undefined;

    /**
     * Constructor
     *
     * @param value
     */
    constructor(value: string) {
        super(value);

        const permitted = this.getPermitted();
        if (permitted) {
            this.permitted = ClientModifier.stripValues(permitted);
            this.permittedNetmasks = ClientModifier.parseNetmasks(this.permitted);
        }

        const restricted = this.getRestricted();
        if (restricted) {
            this.restricted = ClientModifier.stripValues(restricted);
            this.restrictedNetmasks = ClientModifier.parseNetmasks(this.restricted);
        }
    }

    /**
     * Unquotes and unescapes string
     *
     * @param values
     */
    private static stripValues(values: string[]): string[] {
        return values.map((v) => {
            if ((v.startsWith('"') && v.endsWith('"'))
                || (v.startsWith('\'') && v.endsWith('\''))) {
                // eslint-disable-next-line no-param-reassign
                v = v.substr(1, v.length - 2);
            }

            return v.replace(/\\/ig, '');
        });
    }

    /**
     * Checks if this modifier matches provided params
     *
     * @param clientName
     * @param clientIP
     */
    matchAny(clientName: string | undefined, clientIP: string | undefined): boolean {
        if (this.restricted) {
            if (clientName && this.restricted.includes(clientName)) {
                return false;
            }

            if (clientIP && this.restricted.includes(clientIP)) {
                return false;
            }

            return true;
        }

        if (this.restrictedNetmasks) {
            if (clientIP && this.restrictedNetmasks.contains(clientIP)) {
                return false;
            }

            return true;
        }

        if (this.permitted) {
            if (clientName && this.permitted.includes(clientName)) {
                return true;
            }

            if (clientIP && this.permitted.includes(clientIP)) {
                return true;
            }
        }

        if (this.permittedNetmasks) {
            if (clientIP && this.permittedNetmasks.contains(clientIP)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Parses netmasks from client's strings
     *
     * @param values
     */
    private static parseNetmasks(values: string[]): NetmasksCollection {
        const result = new NetmasksCollection();

        values.forEach((x) => {
            const cidrVersion = isCidr(x);
            if (cidrVersion === 4) {
                result.ipv4Masks.push(x);
            } else if (cidrVersion === 6) {
                result.ipv6Masks.push(x);
            }
        });

        return result;
    }
}
