// pnpm vitest bench network-engine
import {
    bench,
    describe,
    expect,
    vi,
} from 'vitest';

import { readFileSync } from 'node:fs';
import { FilterListPreprocessor } from '../../src/filterlist/preprocessor';
import { BufferRuleList } from '../../src/filterlist/buffer-rule-list';
import { RuleStorage } from '../../src/filterlist/rule-storage';
import { NetworkEngine as NetworkEngineOld } from '../../src/engine/network-engine';
import { setLogger } from '../../src/utils/logger';
import { NetworkEngine as NetworkEngineNew1 } from '../../src/engine/network-engine-1';
import { ByteBuffer } from '../../src/utils/byte-buffer';
import { RequestType } from '../../src/request-type';
import { Request } from '../../src/request';

describe('Starting engine', () => {
    setLogger({
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
    });

    let ruleStorage: RuleStorage;
    let buffer: ByteBuffer;
    let hotBuffer: ByteBuffer;

    const setup = () => {
        const rawFilter = readFileSync('test/resources/adguard_base_filter.txt', 'utf-8');
        const processedFilter = FilterListPreprocessor.preprocess(rawFilter);
        const list = new BufferRuleList(0, processedFilter.filterList, false, false, false, processedFilter.sourceMap);
        ruleStorage = new RuleStorage([list]);

        buffer = new ByteBuffer();

        hotBuffer = new ByteBuffer();

        const engine = new NetworkEngineNew1(ruleStorage, hotBuffer, 0);
        engine.finalize();

        hotBuffer.byteOffset = 0;
    };

    bench('Old engine', () => {
        new NetworkEngineOld(ruleStorage);
    }, {
        setup,
    });

    bench('New engine 1 (cold)', () => {
        NetworkEngineNew1.create(ruleStorage, hotBuffer);
    }, {
        setup,
    });

    bench('New engine 1 (hot)', () => {
        new NetworkEngineNew1(ruleStorage, buffer, 0);
    }, {
        setup,
    });
});

describe('Matching', () => {
    setLogger({
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
    });

    const rawFilter = readFileSync('test/resources/adguard_base_filter.txt', 'utf-8');
    const processedFilter = FilterListPreprocessor.preprocess(rawFilter);
    const list = new BufferRuleList(0, processedFilter.filterList, false, false, false, processedFilter.sourceMap);
    const ruleStorage = new RuleStorage([list]);
    const buffer = new ByteBuffer();

    const oldEngine = new NetworkEngineOld(ruleStorage);
    const newEngine1 = new NetworkEngineNew1(ruleStorage, buffer, 0);
    newEngine1.finalize();

    buffer.byteOffset = 0;

    bench('Old engine', () => {
        // Hostname lookup
        oldEngine.match(new Request('https://geo.frtyd.com', '', RequestType.XmlHttpRequest));
        oldEngine.match(new Request('https://hiqubonenete.tk', 'https://example.com', RequestType.XmlHttpRequest));

        // Shortcut lookup
        oldEngine.match(new Request('https://example.com/ads/real_1', 'https://example.com', RequestType.XmlHttpRequest));
        oldEngine.match(new Request('https://yimg.com/dy/ads/dianominewwidget2.html', 'https://yahoo.com', RequestType.XmlHttpRequest));
    });

    bench('New engine 1', () => {
        // Hostname lookup
        newEngine1.match(new Request('https://geo.frtyd.com', '', RequestType.XmlHttpRequest));
        newEngine1.match(new Request('https://hiqubonenete.tk', 'https://example.com', RequestType.XmlHttpRequest));

        // Shortcut lookup
        newEngine1.match(new Request('https://example.com/ads/real_1', 'https://example.com', RequestType.XmlHttpRequest));
        newEngine1.match(new Request('https://yimg.com/dy/ads/dianominewwidget2.html', 'https://yahoo.com', RequestType.XmlHttpRequest));
    }, {
        setup: () => {
            expect(newEngine1.match(new Request('https://geo.frtyd.com', '', RequestType.XmlHttpRequest))).toEqual(oldEngine.match(new Request('https://geo.frtyd.com', '', RequestType.XmlHttpRequest)));
            expect(newEngine1.match(new Request('https://hiqubonenete.tk', 'https://example.com', RequestType.XmlHttpRequest))).toEqual(oldEngine.match(new Request('https://hiqubonenete.tk', 'https://example.com', RequestType.XmlHttpRequest)));
            expect(newEngine1.match(new Request('https://example.com/ads/real_1', 'https://example.com', RequestType.XmlHttpRequest))).toEqual(oldEngine.match(new Request('https://example.com/ads/real_1', 'https://example.com', RequestType.XmlHttpRequest)));
            expect(newEngine1.match(new Request('https://yimg.com/dy/ads/dianominewwidget2.html', 'https://yahoo.com', RequestType.XmlHttpRequest))).toEqual(oldEngine.match(new Request('https://yimg.com/dy/ads/dianominewwidget2.html', 'https://yahoo.com', RequestType.XmlHttpRequest)));
        },
    });
});
