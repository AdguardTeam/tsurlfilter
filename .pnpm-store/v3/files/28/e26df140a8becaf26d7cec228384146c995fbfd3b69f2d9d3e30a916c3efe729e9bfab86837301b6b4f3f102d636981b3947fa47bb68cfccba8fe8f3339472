'use strict';

const polyfills = require('./polyfills.js');

const EMPTY_PATH = polyfills['empty.js'];
function getModules() {
    const libs = new Map();
    libs.set('process', polyfills['process-es6.js']);
    libs.set('global', polyfills['global.js']);
    libs.set('buffer', polyfills['buffer-es6.js']);
    libs.set('util', polyfills['util.js']);
    libs.set('sys', libs.get('util'));
    libs.set('events', polyfills['events.js']);
    libs.set('stream', polyfills['stream.js']);
    libs.set('path', polyfills['path.js']);
    libs.set('querystring', polyfills['querystring.js']);
    libs.set('punycode', polyfills['punycode.js']);
    libs.set('url', polyfills['url.js']);
    libs.set('string_decoder', polyfills['string-decoder.js']);
    libs.set('http', polyfills['http.js']);
    libs.set('https', polyfills['http.js']);
    libs.set('os', polyfills['os.js']);
    libs.set('assert', polyfills['assert.js']);
    libs.set('constants', polyfills['constants.js']);
    libs.set('_stream_duplex', polyfills['__readable-stream/duplex.js']);
    libs.set('_stream_passthrough', polyfills['__readable-stream/passthrough.js']);
    libs.set('_stream_readable', polyfills['__readable-stream/readable.js']);
    libs.set('_stream_writable', polyfills['__readable-stream/writable.js']);
    libs.set('_stream_transform', polyfills['__readable-stream/transform.js']);
    libs.set('_inherits', polyfills['inherits.js']);
    libs.set('_buffer_list', polyfills['__readable-stream/buffer-list.js']);
    libs.set('timers', polyfills['timers.js']);
    libs.set('console', polyfills['console.js']);
    libs.set('vm', polyfills['vm.js']);
    libs.set('zlib', polyfills['zlib.js']);
    libs.set('tty', polyfills['tty.js']);
    libs.set('domain', polyfills['domain.js']);
    // TODO: Decide if we want to implement these or not
    // currently causing trouble in tests
    libs.set('fs', EMPTY_PATH);
    libs.set('crypto', EMPTY_PATH);
    // libs.set('fs', POLYFILLS['browserify-fs.js']);
    // libs.set('crypto', POLYFILLS['crypto-browserify.js']);
    // TODO: No good polyfill exists yet
    libs.set('http2', EMPTY_PATH);
    // not shimmed
    libs.set('dns', EMPTY_PATH);
    libs.set('dgram', EMPTY_PATH);
    libs.set('child_process', EMPTY_PATH);
    libs.set('cluster', EMPTY_PATH);
    libs.set('module', EMPTY_PATH);
    libs.set('net', EMPTY_PATH);
    libs.set('readline', EMPTY_PATH);
    libs.set('repl', EMPTY_PATH);
    libs.set('tls', EMPTY_PATH);
    libs.set('perf_hooks', EMPTY_PATH);
    return libs;
}

exports.getModules = getModules;
