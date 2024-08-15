/**
 * @file
 * This file will be included in the content-script in the extensions.
 * Because of this, this file will only re-export tiny modules to reduce
 * the final size of the package.
 */
export { MessageType } from '../message-constants';
export { sendAppMessage } from './send-app-message';
