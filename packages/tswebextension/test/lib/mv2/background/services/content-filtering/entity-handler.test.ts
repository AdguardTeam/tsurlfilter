import { EntityHandler } from '@lib/mv2/background/services/content-filtering/entity-handler';

describe('EntityHandler', () => {
    it('should escape entities', () => {
        const initial = '<div class="foo">&#x2764; some text</div>';
        const escaped = EntityHandler.escapeEntities(initial);
        expect(escaped).toBe('<div class="foo">&amp;#x2764; some text</div>');
        expect(EntityHandler.revertEntities(escaped)).toBe(initial);
    });
});
