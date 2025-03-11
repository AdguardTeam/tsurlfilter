import { type ModifierValue } from '@adguard/agtree';
import { isString } from '../../utils/string-utils';
import { BaseValuesModifier } from '../values-modifier';

/**
 * The ctag modifier allows to block domains only for specific types of DNS client tags.
 */
export class CtagModifier extends BaseValuesModifier {
    /**
     * The list of allowed tags.
     */
    private static ALLOWED_TAGS = [
        // By device type:
        'device_audio',
        'device_camera',
        'device_gameconsole',
        'device_laptop',
        'device_nas',
        'device_pc',
        'device_phone',
        'device_printer',
        'device_securityalarm',
        'device_tablet',
        'device_tv',
        'device_other',

        // By operating system:
        'os_android',
        'os_ios',
        'os_linux',
        'os_macos',
        'os_windows',
        'os_other',

        // By user group:
        'user_admin',
        'user_regular',
        'user_child',
    ];

    /**
     * Constructor.
     *
     * @param value Value of the modifier.
     */
    constructor(value: string | ModifierValue) {
        let rawValue;

        if (isString(value)) {
            rawValue = value;
        } else if (value.type === 'Value') {
            rawValue = value.value;
        } else {
            throw new Error('Invalid $client rule: value must be a value');
        }

        super(rawValue);

        this.validate();
    }

    /**
     * Validates tag values.
     */
    private validate(): void {
        if (!this.getValue()) {
            throw new Error('Invalid rule: Ctag modifier must not be empty');
        }

        const tags = this.permitted ? this.permitted : this.restricted;
        if (tags && tags.some((x) => !CtagModifier.ALLOWED_TAGS.includes(x))) {
            throw new Error('Invalid rule: Invalid ctag modifier');
        }
    }
}
