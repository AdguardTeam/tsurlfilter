import {
    afterEach,
    describe,
    expect,
    test,
} from 'vitest';

import { CssHitsCounter } from '../../src/lib/common/content-script/css-hits-counter';
import { PendingProbesCollector } from '../../src/lib/common/content-script/pending-probes-collector';

/**
 * Emulates the anti-adblock pattern from AG-48018: a script in `<head>`
 * creates bait elements, checks whether they are hidden and removes them
 * immediately, possibly before the CSS hits counter is initialized.
 *
 * The counter is created asynchronously after the cosmetic data is received,
 * so the elements are collected by {@link PendingProbesCollector} and checked
 * once the counter is ready.
 */
const MARKER_STYLE = [
    "@property --adguard-hit { syntax: '*'; inherits: false; initial-value: ''; }",
    "div.sidebar_ad { display: none !important; --adguard-hit: 'adguard3%3B7' !important; }",
].join('\n');

describe('CSS hits counter: short-lived probes (AG-48018)', () => {
    let counters: CssHitsCounter[] = [];
    let collectors: PendingProbesCollector[] = [];
    let styles: HTMLStyleElement[] = [];
    let elements: Element[] = [];

    /**
     * Creates and starts a collector, registering it for cleanup.
     *
     * @returns Started collector.
     */
    const createCollector = (): PendingProbesCollector => {
        const collector = new PendingProbesCollector();
        collector.start();
        collectors.push(collector);

        return collector;
    };

    /**
     * Creates a counter, registering it for cleanup.
     *
     * @param args Counter constructor arguments.
     *
     * @returns Created counter.
     */
    const createCounter = (...args: ConstructorParameters<typeof CssHitsCounter>): CssHitsCounter => {
        const counter = new CssHitsCounter(...args);
        counters.push(counter);

        return counter;
    };

    /**
     * Injects the marker styles, registering the style for cleanup.
     */
    const addMarkerStyle = (): void => {
        const style = document.createElement('style');
        style.textContent = MARKER_STYLE;
        document.head.appendChild(style);
        styles.push(style);
    };

    /**
     * Registers an element for cleanup.
     *
     * @param element Element to remove after the test.
     *
     * @returns The same element.
     */
    const trackElement = <T extends Element>(element: T): T => {
        elements.push(element);

        return element;
    };

    afterEach(() => {
        counters.forEach((counter) => counter.stop());
        collectors.forEach((collector) => collector.stop());
        styles.forEach((style) => style.remove());
        elements.forEach((element) => element.remove());

        counters = [];
        collectors = [];
        styles = [];
        elements = [];
    });

    test('counts a probe created and removed before the counter initialization', async () => {
        const collector = createCollector();

        // Emulate a script in <head>: create a bait element, check its
        // computed style and remove it in the same task. The marker styles
        // are not injected yet, so the page cannot see it as hidden.
        const bait = trackElement(document.createElement('div'));
        bait.className = 'sidebar_ad';
        document.head.appendChild(bait);
        const isHidden = getComputedStyle(bait).display === 'none';
        bait.remove();

        expect(isHidden).toBe(false);

        // Let the collector's MutationObserver deliver the mutation records.
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
        });

        // Emulate the cosmetic CSS injection.
        addMarkerStyle();

        const hits: Array<{ filterId: number; ruleIndex: number }> = [];
        createCounter((stats) => {
            stats.forEach((stat) => hits.push(stat));
        }, {
            pendingProbes: collector.takePendingProbes(),
        });

        expect(hits).toContainEqual(expect.objectContaining({ filterId: 3, ruleIndex: 7 }));

        // The probe must not stay in the document.
        expect(bait.parentNode).toBeNull();
        expect(document.head.contains(bait)).toBe(false);
    });

    test('counts a probe removed after the counter initialization', async () => {
        const collector = createCollector();

        const hits: Array<{ filterId: number; ruleIndex: number }> = [];
        createCounter((stats) => {
            stats.forEach((stat) => hits.push(stat));
        }, {
            pendingProbesCollector: collector,
        });

        // The element is added while the counter already exists, but the
        // marker styles are not applied yet.
        const bait = trackElement(document.createElement('div'));
        bait.className = 'sidebar_ad';
        document.body.appendChild(bait);

        await new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
        });

        // Marker styles are injected after the element was added.
        addMarkerStyle();

        // The element is removed later, before any full scan can catch it.
        bait.remove();

        await new Promise<void>((resolve) => {
            setTimeout(resolve, 50);
        });

        expect(hits).toContainEqual(expect.objectContaining({ filterId: 3, ruleIndex: 7 }));
        expect(bait.parentNode).toBeNull();
    });

    test('does not remove or move attached elements', () => {
        addMarkerStyle();

        const bait = trackElement(document.createElement('div'));
        bait.className = 'sidebar_ad';
        document.body.appendChild(bait);

        const hits: Array<{ filterId: number; ruleIndex: number }> = [];
        createCounter((stats) => {
            stats.forEach((stat) => hits.push(stat));
        });

        expect(hits).toContainEqual(expect.objectContaining({ filterId: 3, ruleIndex: 7 }));
        expect(bait.parentNode).toBe(document.body);
    });

    test('does not leave a probe in the document when the marker is not applied', () => {
        const bait = trackElement(document.createElement('div'));
        // No rule matches this class, so the counter cannot report a hit.
        bait.className = 'unmatched-bait';

        const hits: unknown[] = [];
        createCounter((stats) => {
            stats.forEach((stat) => hits.push(stat));
        }, {
            pendingProbes: [{
                element: bait,
                target: document.body,
                previousSibling: null,
                nextSibling: null,
            }],
        });

        expect(hits).toHaveLength(0);
        expect(bait.parentNode).toBeNull();
    });
});
