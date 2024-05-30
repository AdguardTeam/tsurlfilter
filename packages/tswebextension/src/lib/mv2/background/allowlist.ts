import { Allowlist as CommonAllowlist } from '../../common/allowlist';

/**
 * The allowlist is used to exclude certain websites from filtering.
 * Blocking rules are not applied to the sites in the list.
 * The allow list can also be inverted.
 * In inverted mode, the application will unblock ads everywhere except for the sites added to this list.
 */
export class Allowlist extends CommonAllowlist { }
