/**
 * @typedef {import('../background/services/stealth-service').StealthService} StealthService
 */
/**
 * @file
 * IMPORTANT: This file should be listed inside 'sideEffects' field
 * in the package.json, because it has side effects: we do not export anything
 * from it outside, just evaluate the code (via injection).
 *
 * We will inject this script dynamically via `scripting.registerContentScripts`
 * inside {@link StealthService.setContentScript}.
 */
import { StealthHelper } from '../../common/stealth-helper';

StealthHelper.hideDocumentReferrer();
