import { describe, expect, it } from 'vitest';

import {
    hasTypeField,
    isAssistantMessage,
} from '../../../../../src/lib/common/content-script/assistant/message-type-guards';
import { MESSAGE_HANDLER_NAME, MessageType } from '../../../../../src/lib/common/message-constants';

describe('Message type guards', () => {
    describe('hasTypeField', () => {
        it('returns false for non-objects', () => {
            expect(hasTypeField(null)).toBe(false);
            expect(hasTypeField(undefined)).toBe(false);
            expect(hasTypeField('string')).toBe(false);
            expect(hasTypeField(123)).toBe(false);
            expect(hasTypeField(true)).toBe(false);
        });

        it('returns false for objects without type field', () => {
            expect(hasTypeField({})).toBe(false);
            expect(hasTypeField({ handlerName: MESSAGE_HANDLER_NAME })).toBe(false);
            expect(hasTypeField({ payload: {} })).toBe(false);
        });

        it('returns true for objects with type field', () => {
            expect(hasTypeField({ type: MessageType.InitAssistant })).toBe(true);
            expect(hasTypeField({ type: MessageType.CloseAssistant })).toBe(true);
            expect(hasTypeField({ type: 'anyString' })).toBe(true);
        });
    });

    describe('isAssistantMessage', () => {
        it('returns false for non-objects', () => {
            expect(isAssistantMessage(null)).toBe(false);
            expect(isAssistantMessage(undefined)).toBe(false);
            expect(isAssistantMessage('string')).toBe(false);
            expect(isAssistantMessage(123)).toBe(false);
            expect(isAssistantMessage(true)).toBe(false);
        });

        it('returns false for objects without handlerName', () => {
            expect(isAssistantMessage({})).toBe(false);
            expect(isAssistantMessage({ type: MessageType.InitAssistant })).toBe(false);
            expect(isAssistantMessage({ payload: {} })).toBe(false);
        });

        it('returns false for objects with wrong handlerName', () => {
            expect(isAssistantMessage({
                handlerName: 'wrongHandler',
                type: MessageType.InitAssistant,
            })).toBe(false);

            expect(isAssistantMessage({
                handlerName: 'someOtherExtension',
                type: MessageType.CloseAssistant,
            })).toBe(false);

            // This simulates messages from other extensions like showVersionUpdatedPopup
            expect(isAssistantMessage({
                type: 'showVersionUpdatedPopup',
            })).toBe(false);
        });

        it('returns true for valid assistant messages', () => {
            expect(isAssistantMessage({
                handlerName: MESSAGE_HANDLER_NAME,
                type: MessageType.InitAssistant,
            })).toBe(true);

            expect(isAssistantMessage({
                handlerName: MESSAGE_HANDLER_NAME,
                type: MessageType.CloseAssistant,
            })).toBe(true);

            // With additional fields
            expect(isAssistantMessage({
                handlerName: MESSAGE_HANDLER_NAME,
                type: MessageType.InitAssistant,
                payload: { someData: 'value' },
            })).toBe(true);
        });

        it('filters out messages from other extensions', () => {
            // Simulates the bug case: extension update popup message
            const updatePopupMessage = {
                type: 'showVersionUpdatedPopup',
                version: '1.0.0',
            };

            expect(isAssistantMessage(updatePopupMessage)).toBe(false);
        });
    });
});
