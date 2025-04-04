/* eslint-disable max-len */
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

// describe('Starting engine', () => {
//     setLogger({
//         error: vi.fn(),
//         info: vi.fn(),
//         debug: vi.fn(),
//         warn: vi.fn(),
//     });

//     let ruleStorage: RuleStorage;
//     let buffer: ByteBuffer;
//     let hotBuffer: ByteBuffer;

//     const setup = () => {
//         const rawFilter = readFileSync('test/resources/adguard_base_filter.txt', 'utf-8');
//         const processedFilter = FilterListPreprocessor.preprocess(rawFilter);
//         const list = new BufferRuleList(0, processedFilter.filterList, false, false, false, processedFilter.sourceMap);
//         ruleStorage = new RuleStorage([list]);

//         buffer = new ByteBuffer();

//         hotBuffer = new ByteBuffer();

//         const engine = new NetworkEngineNew1(ruleStorage, hotBuffer, 0);
//         engine.finalize();

//         hotBuffer.byteOffset = 0;
//     };

//     bench('Old engine', () => {
//         new NetworkEngineOld(ruleStorage);
//     }, {
//         setup,
//     });

//     bench('New engine 1 (cold)', () => {
//         NetworkEngineNew1.create(ruleStorage, hotBuffer);
//     }, {
//         setup,
//     });

//     bench('New engine 1 (hot)', () => {
//         new NetworkEngineNew1(ruleStorage, buffer, 0);
//     }, {
//         setup,
//     });
// });

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
    const newEngine1 = NetworkEngineNew1.create(ruleStorage, buffer);
    newEngine1.finalize();

    // ||twinsporn.net/images/free-penis-pills.png
    // ||turboimagehost.com/p1.js
    expect(oldEngine.match(new Request('https://twinsporn.net/images/free-penis-pills.png', 'https://twinsporn.net', RequestType.Image))).not.toBeNull();
    expect(newEngine1.match(new Request('https://twinsporn.net/images/free-penis-pills.png', 'https://twinsporn.net', RequestType.Image))).toEqual(oldEngine.match(new Request('https://twinsporn.net/images/free-penis-pills.png', 'https://twinsporn.net', RequestType.Image)));
    expect(oldEngine.match(new Request('https://turboimagehost.com/p1.js', 'https://turboimagehost.com', RequestType.Script))).not.toBeNull();
    expect(newEngine1.match(new Request('https://turboimagehost.com/p1.js', 'https://turboimagehost.com', RequestType.Script))).toEqual(oldEngine.match(new Request('https://turboimagehost.com/p1.js', 'https://turboimagehost.com', RequestType.Script)));

    bench('Old engine - Hostname lookup', () => {
        oldEngine.match(new Request('https://twinsporn.net/images/free-penis-pills.png', 'https://twinsporn.net', RequestType.Image));
        oldEngine.match(new Request('https://turboimagehost.com/p1.js', 'https://turboimagehost.com', RequestType.Script));
    });

    bench('New engine 1 - Hostname lookup', () => {
        newEngine1.match(new Request('https://twinsporn.net/images/free-penis-pills.png', 'https://twinsporn.net', RequestType.Image));
        newEngine1.match(new Request('https://hiqubonenete.tk', 'https://example.com', RequestType.XmlHttpRequest));
    });

    // ||gifsfor.com^*/msn.js
    // ||imagedunk.com^*_imagedunk.js
    expect(oldEngine.match(new Request('https://gifsfor.com/scripts/msn.js', 'https://gifsfor.com', RequestType.Script))).not.toBeNull();
    expect(newEngine1.match(new Request('https://gifsfor.com/scripts/msn.js', 'https://gifsfor.com', RequestType.Script))).toEqual(oldEngine.match(new Request('https://gifsfor.com/scripts/msn.js', 'https://gifsfor.com', RequestType.Script)));
    expect(oldEngine.match(new Request('https://imagedunk.com/scripts/foo_imagedunk.js', 'https://imagedunk.com', RequestType.Script))).not.toBeNull();
    expect(newEngine1.match(new Request('https://imagedunk.com/scripts/foo_imagedunk.js', 'https://imagedunk.com', RequestType.Script))).toEqual(oldEngine.match(new Request('https://imagedunk.com/scripts/foo_imagedunk.js', 'https://imagedunk.com', RequestType.Script)));

    bench('Old engine - Trie lookup', () => {
        oldEngine.match(new Request('https://gifsfor.com/scripts/msn.js', 'https://gifsfor.com', RequestType.Script));
        oldEngine.match(new Request('https://imagedunk.com/scripts/foo_imagedunk.js', 'https://imagedunk.com', RequestType.Script));
    });

    bench('New engine 1 - Trie lookup', () => {
        newEngine1.match(new Request('https://gifsfor.com/scripts/msn.js', 'https://gifsfor.com', RequestType.Script));
        newEngine1.match(new Request('https://imagedunk.com/scripts/imagedunk.js', 'https://imagedunk.com', RequestType.Script));
    });

    // http*://$script,third-party,xmlhttprequest,domain=cnbtspread.xyz
    // |http*://$image,other,third-party,domain=mp3clan.one|powvideo.net|streamplay.to
    expect(oldEngine.match(new Request('https://example.com/a.js', 'https://cnbtspread.xyz', RequestType.Script))).not.toBeNull();
    expect(newEngine1.match(new Request('https://example.com/a.js', 'https://cnbtspread.xyz', RequestType.Script))).toEqual(oldEngine.match(new Request('https://example.com/a.js', 'https://cnbtspread.xyz', RequestType.Script)));
    expect(oldEngine.match(new Request('https://example.com/a.jpg', 'https://mp3clan.one', RequestType.Image))).not.toBeNull();
    expect(newEngine1.match(new Request('https://example.com/a.jpg', 'https://mp3clan.one', RequestType.Image))).toEqual(oldEngine.match(new Request('https://example.com/a.jpg', 'https://mp3clan.one', RequestType.Image)));

    bench('Old engine - Domains lookup', () => {
        oldEngine.match(new Request('https://example.com/a.js', 'https://cnbtspread.xyz', RequestType.Script));
        oldEngine.match(new Request('https://example.com/a.jpg', 'https://mp3clan.one', RequestType.Image));
    });

    bench('New engine 1 - Domains lookup', () => {
        newEngine1.match(new Request('https://example.com/a.js', 'https://cnbtspread.xyz', RequestType.Script));
        newEngine1.match(new Request('https://example.com/a.jpg', 'https://mp3clan.one', RequestType.Image));
    });

    // /\.(accountant|bid|click|club|com|cricket|date|download|faith|link|loan|lol|men|online|party|racing|review|science|site|space|stream|top|trade|webcam|website|win|xyz|com)\/(([0-9]{2,9})(\.|\/)(css|\?)?)$/$script,stylesheet,third-party,xmlhttprequest
    // /^https?:\/\/([0-9a-z\-]+\.)?(animeland|animenova|animeplus|animetoon|animewow|gamestorrent|goodanime|gogoanime|igg-games|kimcartoon|memecenter|readcomiconline|toonget|toonova|watchcartoononline)\.[a-z]{2,4}\/(?!([Ee]xternal|[Ii]mages|[Ss]cripts|[Uu]ploads|ac|ajax|assets|combined|content|cov|cover|(img\/bg)|(img\/icon)|inc|jwplayer|player|playlist-cat-rss|static|thumbs|wp-content|wp-includes)\/)(.*)/$image,other,script,~third-party,xmlhttprequest,domain=~animeland.hu|~memecenter.fr
    expect(oldEngine.match(new Request('https://example.website/1234567.css', 'https://example.com', RequestType.XmlHttpRequest))).not.toBeNull();
    expect(newEngine1.match(new Request('https://example.website/1234567.css', 'https://example.com', RequestType.XmlHttpRequest))).toEqual(oldEngine.match(new Request('https://example.website/1234567.css', 'https://example.com', RequestType.XmlHttpRequest)));
    expect(oldEngine.match(new Request('https://gogoanime.io/naruto-episode-1', 'https://gogoanime.io', RequestType.Other))).not.toBeNull();
    expect(newEngine1.match(new Request('https://gogoanime.io/naruto-episode-1', 'https://gogoanime.io', RequestType.Other))).toEqual(oldEngine.match(new Request('https://gogoanime.io/naruto-episode-1', 'https://gogoanime.io', RequestType.Other)));

    bench('Old engine - Seq scan lookup', () => {
        oldEngine.match(new Request('https://example.website/1234567.css', 'https://example.com', RequestType.XmlHttpRequest));
        oldEngine.match(new Request('https://gogoanime.io/naruto-episode-1', 'https://gogoanime.io', RequestType.Other));
    });

    bench('New engine 1 - Seq scan lookup', () => {
        newEngine1.match(new Request('https://example.website/1234567.css', 'https://example.com', RequestType.XmlHttpRequest));
        newEngine1.match(new Request('https://gogoanime.io/naruto-episode-1', 'https://gogoanime.io', RequestType.Other));
    });
});
