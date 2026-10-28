/**
 * @vitest-environment jsdom
 */

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    MAX_PENDING_PROBES,
    PendingProbesCollector,
} from '../../../../src/lib/common/content-script/pending-probes-collector';
import { mockMutationObserver, MutationObserverMock } from '../../../helpers/mutation-observer';

/**
 * Creates a mutation record for tests.
 *
 * @param params Record parameters.
 * @param params.addedNodes Added nodes.
 * @param params.removedNodes Removed nodes.
 * @param params.target Mutation target.
 * @param params.previousSibling Previous sibling.
 * @param params.nextSibling Next sibling.
 *
 * @returns Mutation record.
 */
const createMutationRecord = ({
    addedNodes = [],
    removedNodes = [],
    target,
    previousSibling = null,
    nextSibling = null,
}: {
    addedNodes?: Node[];
    removedNodes?: Node[];
    target: Node;
    previousSibling?: Node | null;
    nextSibling?: Node | null;
}): MutationRecord => ({
    addedNodes: addedNodes as unknown as NodeList,
    removedNodes: removedNodes as unknown as NodeList,
    target,
    previousSibling,
    nextSibling,
    type: 'childList',
    attributeName: null,
    attributeNamespace: null,
    oldValue: null,
} as unknown as MutationRecord);

describe('PendingProbesCollector', () => {
    let restoreMutationObserver: () => void;

    beforeEach(() => {
        restoreMutationObserver = mockMutationObserver();
    });

    afterEach(() => {
        restoreMutationObserver();
    });

    it('observes the document from the start', () => {
        const collector = new PendingProbesCollector();
        collector.start();

        const observer = MutationObserverMock.last!;
        expect(observer.observedNodes).toEqual([document]);
        expect(observer.observedOptions).toEqual({ childList: true, subtree: true });

        collector.stop();
    });

    it('collects an element added and removed before the observer callback', () => {
        const collector = new PendingProbesCollector();
        collector.start();

        const target = document.body;
        const previousSibling = document.createElement('div');
        const nextSibling = document.createElement('div');
        const bait = document.createElement('div');
        target.append(previousSibling, nextSibling);

        MutationObserverMock.last!.trigger([createMutationRecord({
            addedNodes: [bait],
            target,
            previousSibling,
            nextSibling,
        })]);

        const probes = collector.takePendingProbes();

        expect(probes).toHaveLength(1);
        expect(probes[0].element).toBe(bait);
        expect(probes[0].target).toBe(target);
        expect(probes[0].previousSibling).toBe(previousSibling);
        expect(probes[0].nextSibling).toBe(nextSibling);

        previousSibling.remove();
        nextSibling.remove();
        collector.stop();
    });

    it('collects an element added and removed in a later task', () => {
        const collector = new PendingProbesCollector();
        collector.start();

        const bait = document.createElement('div');
        document.body.appendChild(bait);

        // The addition callback sees the element attached.
        MutationObserverMock.last!.trigger([createMutationRecord({
            addedNodes: [bait],
            target: document.body,
        })]);

        // The element is removed later.
        bait.remove();
        MutationObserverMock.last!.trigger([createMutationRecord({
            removedNodes: [bait],
            target: document.body,
        })]);

        const probes = collector.takePendingProbes();

        expect(probes).toHaveLength(1);
        expect(probes[0].element).toBe(bait);

        collector.stop();
    });

    it('collects a bait added inside a container appended to the document', () => {
        const collector = new PendingProbesCollector();
        collector.start();

        // The bait is created inside a detached container, so the observer
        // does not see its addition; only the container is appended.
        const container = document.createElement('div');
        const bait = document.createElement('div');
        container.appendChild(bait);
        document.body.appendChild(container);

        MutationObserverMock.last!.trigger([createMutationRecord({
            addedNodes: [container],
            target: document.body,
        })]);

        // The bait is removed from the container later.
        bait.remove();
        MutationObserverMock.last!.trigger([createMutationRecord({
            removedNodes: [bait],
            target: container,
        })]);

        const probes = collector.takePendingProbes();

        expect(probes).toHaveLength(1);
        expect(probes[0].element).toBe(bait);
        expect(probes[0].target).toBe(container);

        container.remove();
        collector.stop();
    });

    it('collects a bait removed in the same task its container was appended', () => {
        const collector = new PendingProbesCollector();
        collector.start();

        const container = document.createElement('div');
        const bait = document.createElement('div');
        container.appendChild(bait);
        document.body.appendChild(container);

        // Both mutations happen before the observer callback: the container
        // is appended and the bait is removed in the same task.
        bait.remove();
        MutationObserverMock.last!.trigger([
            createMutationRecord({
                addedNodes: [container],
                target: document.body,
            }),
            createMutationRecord({
                removedNodes: [bait],
                target: container,
            }),
        ]);

        const probes = collector.takePendingProbes();

        expect(probes).toHaveLength(1);
        expect(probes[0].element).toBe(bait);
        expect(probes[0].target).toBe(container);

        container.remove();
        collector.stop();
    });

    it('ignores script tags and duplicate elements', () => {
        const collector = new PendingProbesCollector();
        collector.start();

        const script = document.createElement('script');
        const bait = document.createElement('div');
        const record = createMutationRecord({
            addedNodes: [script, bait],
            target: document.body,
        });

        MutationObserverMock.last!.trigger([record, record]);

        const probes = collector.takePendingProbes();

        expect(probes.map((probe) => probe.element)).toEqual([bait]);

        collector.stop();
    });

    it('ignores resource-bearing and structural tags', () => {
        const collector = new PendingProbesCollector();
        collector.start();

        const ignoredElements = ['img', 'link', 'iframe', 'style', 'meta', 'video']
            .map((tag) => document.createElement(tag));
        const bait = document.createElement('div');

        MutationObserverMock.last!.trigger([createMutationRecord({
            addedNodes: [...ignoredElements, bait],
            target: document.body,
        })]);

        const probes = collector.takePendingProbes();

        expect(probes.map((probe) => probe.element)).toEqual([bait]);

        collector.stop();
    });

    it('ignores custom elements', () => {
        const collector = new PendingProbesCollector();
        collector.start();

        const customElement = document.createElement('ytd-player');
        const bait = document.createElement('div');

        MutationObserverMock.last!.trigger([createMutationRecord({
            addedNodes: [customElement, bait],
            target: document.body,
        })]);

        const probes = collector.takePendingProbes();

        expect(probes.map((probe) => probe.element)).toEqual([bait]);

        collector.stop();
    });

    it('ignores elements whose subtree contains a non-restorable tag', () => {
        const collector = new PendingProbesCollector();
        collector.start();

        const withIframe = document.createElement('div');
        withIframe.appendChild(document.createElement('iframe'));

        const withCustomElement = document.createElement('div');
        withCustomElement.appendChild(document.createElement('my-widget'));

        const withImage = document.createElement('div');
        withImage.appendChild(document.createElement('img'));

        // An SVG image loads its `href`, so a bait that contains one must
        // not be restored.
        const withSvgImage = document.createElement('div');
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const svgImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        svgImage.setAttribute('href', 'https://example.com/pixel.png');
        svg.appendChild(svgImage);
        withSvgImage.appendChild(svg);

        const bait = document.createElement('div');

        MutationObserverMock.last!.trigger([createMutationRecord({
            addedNodes: [withIframe, withCustomElement, withImage, withSvgImage, bait],
            target: document.body,
        })]);

        const probes = collector.takePendingProbes();

        expect(probes.map((probe) => probe.element)).toEqual([bait]);

        collector.stop();
    });

    it('collects a bait whose subtree contains a script', () => {
        const collector = new PendingProbesCollector();
        collector.start();

        // Anti-adblock baits often append a script. Re-inserting an already
        // executed script does not run it again, so such a bait is restorable.
        const withScript = document.createElement('div');
        withScript.appendChild(document.createElement('script'));

        MutationObserverMock.last!.trigger([createMutationRecord({
            addedNodes: [withScript],
            target: document.body,
        })]);

        const probes = collector.takePendingProbes();

        expect(probes.map((probe) => probe.element)).toEqual([withScript]);

        collector.stop();
    });

    it('returns collected probes and keeps observing', () => {
        const collector = new PendingProbesCollector();
        collector.start();

        const firstBait = document.createElement('div');
        MutationObserverMock.last!.trigger([createMutationRecord({
            addedNodes: [firstBait],
            target: document.body,
        })]);

        expect(collector.takePendingProbes()).toHaveLength(1);

        const secondBait = document.createElement('div');
        MutationObserverMock.last!.trigger([createMutationRecord({
            addedNodes: [secondBait],
            target: document.body,
        })]);

        const probes = collector.takePendingProbes();
        expect(probes).toHaveLength(1);
        expect(probes[0].element).toBe(secondBait);

        collector.stop();
    });

    it('drops collected elements on stop', () => {
        const collector = new PendingProbesCollector();
        collector.start();

        const bait = document.createElement('div');
        MutationObserverMock.last!.trigger([createMutationRecord({
            addedNodes: [bait],
            target: document.body,
        })]);

        collector.stop();

        expect(collector.takePendingProbes()).toHaveLength(0);
    });

    it('processes mutation records that were not delivered before take', () => {
        const collector = new PendingProbesCollector();
        collector.start();

        const bait = document.createElement('div');
        MutationObserverMock.last!.enqueueRecords([createMutationRecord({
            addedNodes: [bait],
            target: document.body,
        })]);

        const probes = collector.takePendingProbes();

        expect(probes).toHaveLength(1);
        expect(probes[0].element).toBe(bait);

        collector.stop();
    });

    it('keeps the earliest probes when the queue is full', () => {
        const collector = new PendingProbesCollector();
        collector.start();

        const maxPendingProbes = 500;
        const elements = Array.from(
            { length: maxPendingProbes + 1 },
            () => document.createElement('div'),
        );

        MutationObserverMock.last!.trigger([createMutationRecord({
            addedNodes: elements,
            target: document.body,
        })]);

        const probes = collector.takePendingProbes();

        expect(probes).toHaveLength(maxPendingProbes);
        // Baits from a script in `<head>` come first, so they are kept.
        expect(probes[0].element).toBe(elements[0]);
        expect(probes.some((probe) => probe.element === elements[maxPendingProbes])).toBe(false);

        collector.stop();
    });

    it('does not scan a detached subtree after the queue is full', () => {
        const collector = new PendingProbesCollector();
        collector.start();

        const fillers = Array.from(
            { length: MAX_PENDING_PROBES },
            () => document.createElement('div'),
        );

        MutationObserverMock.last!.trigger([createMutationRecord({
            addedNodes: fillers,
            target: document.body,
        })]);

        const candidate = document.createElement('div');
        candidate.appendChild(document.createElement('iframe'));
        const querySelectorAllSpy = vi.spyOn(candidate, 'querySelectorAll');

        try {
            // The queue is full, so the candidate is dropped without
            // scanning its subtree.
            MutationObserverMock.last!.trigger([createMutationRecord({
                addedNodes: [candidate],
                target: document.body,
            })]);

            expect(querySelectorAllSpy).not.toHaveBeenCalled();
            expect(collector.takePendingProbes()).toHaveLength(MAX_PENDING_PROBES);
        } finally {
            querySelectorAllSpy.mockRestore();
            collector.stop();
        }
    });

    it('allows a dropped element to be collected when it is added and removed again', () => {
        const collector = new PendingProbesCollector();
        collector.start();

        const maxPendingProbes = 500;
        const elements = Array.from(
            { length: maxPendingProbes + 1 },
            () => document.createElement('div'),
        );

        MutationObserverMock.last!.trigger([createMutationRecord({
            addedNodes: elements,
            target: document.body,
        })]);

        // The last element is dropped by the cap.
        expect(collector.takePendingProbes()).toHaveLength(maxPendingProbes);

        // The queue is drained; the page adds the dropped element again and
        // removes it, so it can be collected now.
        const droppedElement = elements[maxPendingProbes];
        document.body.appendChild(droppedElement);
        MutationObserverMock.last!.trigger([createMutationRecord({
            addedNodes: [droppedElement],
            target: document.body,
        })]);

        droppedElement.remove();
        MutationObserverMock.last!.trigger([createMutationRecord({
            removedNodes: [droppedElement],
            target: document.body,
        })]);

        const probes = collector.takePendingProbes();
        expect(probes.some((probe) => probe.element === droppedElement)).toBe(true);

        collector.stop();
    });

    it('stops observing and drops collected probes after the observation timeout', () => {
        vi.useFakeTimers();

        try {
            const collector = new PendingProbesCollector();
            collector.start();

            const bait = document.createElement('div');
            MutationObserverMock.last!.trigger([createMutationRecord({
                addedNodes: [bait],
                target: document.body,
            })]);

            vi.advanceTimersByTime(30000);

            expect(MutationObserverMock.last!.isDisconnected).toBe(true);
            // Detached subtrees must not be retained after observation ends.
            expect(collector.takePendingProbes()).toHaveLength(0);

            collector.stop();
        } finally {
            vi.useRealTimers();
        }
    });

    it('notifies a subscriber about newly collected probes', () => {
        const collector = new PendingProbesCollector();
        collector.start();

        const onProbesCollected = vi.fn();
        collector.setOnProbesCollected(onProbesCollected);

        const bait = document.createElement('div');
        MutationObserverMock.last!.trigger([createMutationRecord({
            addedNodes: [bait],
            target: document.body,
        })]);

        expect(onProbesCollected).toHaveBeenCalledTimes(1);
        expect(onProbesCollected.mock.calls[0][0]).toHaveLength(1);
        expect(onProbesCollected.mock.calls[0][0][0].element).toBe(bait);

        collector.stop();
    });

    it('passes probes collected before the subscription to the subscriber', () => {
        const collector = new PendingProbesCollector();
        collector.start();

        const bait = document.createElement('div');
        MutationObserverMock.last!.trigger([createMutationRecord({
            addedNodes: [bait],
            target: document.body,
        })]);

        const onProbesCollected = vi.fn();
        collector.setOnProbesCollected(onProbesCollected);

        expect(onProbesCollected).toHaveBeenCalledTimes(1);
        expect(onProbesCollected.mock.calls[0][0][0].element).toBe(bait);

        collector.stop();
    });

    it('flushes undelivered mutation records when a subscriber is set', () => {
        const collector = new PendingProbesCollector();
        collector.start();

        const bait = document.createElement('div');
        // The record is queued in the observer but not delivered yet.
        MutationObserverMock.last!.enqueueRecords([createMutationRecord({
            addedNodes: [bait],
            target: document.body,
        })]);

        const onProbesCollected = vi.fn();
        collector.setOnProbesCollected(onProbesCollected);

        expect(onProbesCollected).toHaveBeenCalledTimes(1);
        expect(onProbesCollected.mock.calls[0][0][0].element).toBe(bait);

        collector.stop();
    });
});
