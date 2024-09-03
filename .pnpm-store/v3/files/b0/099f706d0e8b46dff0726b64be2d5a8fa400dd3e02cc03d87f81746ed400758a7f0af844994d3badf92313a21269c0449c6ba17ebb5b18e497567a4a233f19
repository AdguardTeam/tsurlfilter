var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

function getAugmentedNamespace(n) {
  if (n.__esModule) return n;
  var f = n.default;
	if (typeof f == "function") {
		var a = function a () {
			if (this instanceof a) {
        return Reflect.construct(f, arguments, this.constructor);
			}
			return f.apply(this, arguments);
		};
		a.prototype = f.prototype;
  } else a = {};
  Object.defineProperty(a, '__esModule', {value: true});
	Object.keys(n).forEach(function (k) {
		var d = Object.getOwnPropertyDescriptor(n, k);
		Object.defineProperty(a, k, d.get ? d : {
			enumerable: true,
			get: function () {
				return n[k];
			}
		});
	});
	return a;
}

var sha1 = {exports: {}};

function commonjsRequire(path) {
	throw new Error('Could not dynamically require "' + path + '". Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.');
}

var core = {exports: {}};

var _nodeResolve_empty = {};

var _nodeResolve_empty$1 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	default: _nodeResolve_empty
});

var require$$0 = /*@__PURE__*/getAugmentedNamespace(_nodeResolve_empty$1);

var hasRequiredCore;
function requireCore () {
	if (hasRequiredCore) return core.exports;
	hasRequiredCore = 1;
	(function (module, exports) {
(function (root, factory) {
			{
				module.exports = factory();
			}
		}(commonjsGlobal, function () {
			var CryptoJS = CryptoJS || (function (Math, undefined$1) {
			    var crypto;
			    if (typeof window !== 'undefined' && window.crypto) {
			        crypto = window.crypto;
			    }
			    if (typeof self !== 'undefined' && self.crypto) {
			        crypto = self.crypto;
			    }
			    if (typeof globalThis !== 'undefined' && globalThis.crypto) {
			        crypto = globalThis.crypto;
			    }
			    if (!crypto && typeof window !== 'undefined' && window.msCrypto) {
			        crypto = window.msCrypto;
			    }
			    if (!crypto && typeof commonjsGlobal !== 'undefined' && commonjsGlobal.crypto) {
			        crypto = commonjsGlobal.crypto;
			    }
			    if (!crypto && typeof commonjsRequire === 'function') {
			        try {
			            crypto = require$$0;
			        } catch (err) {}
			    }
			    var cryptoSecureRandomInt = function () {
			        if (crypto) {
			            if (typeof crypto.getRandomValues === 'function') {
			                try {
			                    return crypto.getRandomValues(new Uint32Array(1))[0];
			                } catch (err) {}
			            }
			            if (typeof crypto.randomBytes === 'function') {
			                try {
			                    return crypto.randomBytes(4).readInt32LE();
			                } catch (err) {}
			            }
			        }
			        throw new Error('Native crypto module could not be used to get secure random number.');
			    };
			    var create = Object.create || (function () {
			        function F() {}
			        return function (obj) {
			            var subtype;
			            F.prototype = obj;
			            subtype = new F();
			            F.prototype = null;
			            return subtype;
			        };
			    }());
			    var C = {};
			    var C_lib = C.lib = {};
			    var Base = C_lib.Base = (function () {
			        return {
			            extend: function (overrides) {
			                var subtype = create(this);
			                if (overrides) {
			                    subtype.mixIn(overrides);
			                }
			                if (!subtype.hasOwnProperty('init') || this.init === subtype.init) {
			                    subtype.init = function () {
			                        subtype.$super.init.apply(this, arguments);
			                    };
			                }
			                subtype.init.prototype = subtype;
			                subtype.$super = this;
			                return subtype;
			            },
			            create: function () {
			                var instance = this.extend();
			                instance.init.apply(instance, arguments);
			                return instance;
			            },
			            init: function () {
			            },
			            mixIn: function (properties) {
			                for (var propertyName in properties) {
			                    if (properties.hasOwnProperty(propertyName)) {
			                        this[propertyName] = properties[propertyName];
			                    }
			                }
			                if (properties.hasOwnProperty('toString')) {
			                    this.toString = properties.toString;
			                }
			            },
			            clone: function () {
			                return this.init.prototype.extend(this);
			            }
			        };
			    }());
			    var WordArray = C_lib.WordArray = Base.extend({
			        init: function (words, sigBytes) {
			            words = this.words = words || [];
			            if (sigBytes != undefined$1) {
			                this.sigBytes = sigBytes;
			            } else {
			                this.sigBytes = words.length * 4;
			            }
			        },
			        toString: function (encoder) {
			            return (encoder || Hex).stringify(this);
			        },
			        concat: function (wordArray) {
			            var thisWords = this.words;
			            var thatWords = wordArray.words;
			            var thisSigBytes = this.sigBytes;
			            var thatSigBytes = wordArray.sigBytes;
			            this.clamp();
			            if (thisSigBytes % 4) {
			                for (var i = 0; i < thatSigBytes; i++) {
			                    var thatByte = (thatWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
			                    thisWords[(thisSigBytes + i) >>> 2] |= thatByte << (24 - ((thisSigBytes + i) % 4) * 8);
			                }
			            } else {
			                for (var j = 0; j < thatSigBytes; j += 4) {
			                    thisWords[(thisSigBytes + j) >>> 2] = thatWords[j >>> 2];
			                }
			            }
			            this.sigBytes += thatSigBytes;
			            return this;
			        },
			        clamp: function () {
			            var words = this.words;
			            var sigBytes = this.sigBytes;
			            words[sigBytes >>> 2] &= 0xffffffff << (32 - (sigBytes % 4) * 8);
			            words.length = Math.ceil(sigBytes / 4);
			        },
			        clone: function () {
			            var clone = Base.clone.call(this);
			            clone.words = this.words.slice(0);
			            return clone;
			        },
			        random: function (nBytes) {
			            var words = [];
			            for (var i = 0; i < nBytes; i += 4) {
			                words.push(cryptoSecureRandomInt());
			            }
			            return new WordArray.init(words, nBytes);
			        }
			    });
			    var C_enc = C.enc = {};
			    var Hex = C_enc.Hex = {
			        stringify: function (wordArray) {
			            var words = wordArray.words;
			            var sigBytes = wordArray.sigBytes;
			            var hexChars = [];
			            for (var i = 0; i < sigBytes; i++) {
			                var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
			                hexChars.push((bite >>> 4).toString(16));
			                hexChars.push((bite & 0x0f).toString(16));
			            }
			            return hexChars.join('');
			        },
			        parse: function (hexStr) {
			            var hexStrLength = hexStr.length;
			            var words = [];
			            for (var i = 0; i < hexStrLength; i += 2) {
			                words[i >>> 3] |= parseInt(hexStr.substr(i, 2), 16) << (24 - (i % 8) * 4);
			            }
			            return new WordArray.init(words, hexStrLength / 2);
			        }
			    };
			    var Latin1 = C_enc.Latin1 = {
			        stringify: function (wordArray) {
			            var words = wordArray.words;
			            var sigBytes = wordArray.sigBytes;
			            var latin1Chars = [];
			            for (var i = 0; i < sigBytes; i++) {
			                var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
			                latin1Chars.push(String.fromCharCode(bite));
			            }
			            return latin1Chars.join('');
			        },
			        parse: function (latin1Str) {
			            var latin1StrLength = latin1Str.length;
			            var words = [];
			            for (var i = 0; i < latin1StrLength; i++) {
			                words[i >>> 2] |= (latin1Str.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
			            }
			            return new WordArray.init(words, latin1StrLength);
			        }
			    };
			    var Utf8 = C_enc.Utf8 = {
			        stringify: function (wordArray) {
			            try {
			                return decodeURIComponent(escape(Latin1.stringify(wordArray)));
			            } catch (e) {
			                throw new Error('Malformed UTF-8 data');
			            }
			        },
			        parse: function (utf8Str) {
			            return Latin1.parse(unescape(encodeURIComponent(utf8Str)));
			        }
			    };
			    var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm = Base.extend({
			        reset: function () {
			            this._data = new WordArray.init();
			            this._nDataBytes = 0;
			        },
			        _append: function (data) {
			            if (typeof data == 'string') {
			                data = Utf8.parse(data);
			            }
			            this._data.concat(data);
			            this._nDataBytes += data.sigBytes;
			        },
			        _process: function (doFlush) {
			            var processedWords;
			            var data = this._data;
			            var dataWords = data.words;
			            var dataSigBytes = data.sigBytes;
			            var blockSize = this.blockSize;
			            var blockSizeBytes = blockSize * 4;
			            var nBlocksReady = dataSigBytes / blockSizeBytes;
			            if (doFlush) {
			                nBlocksReady = Math.ceil(nBlocksReady);
			            } else {
			                nBlocksReady = Math.max((nBlocksReady | 0) - this._minBufferSize, 0);
			            }
			            var nWordsReady = nBlocksReady * blockSize;
			            var nBytesReady = Math.min(nWordsReady * 4, dataSigBytes);
			            if (nWordsReady) {
			                for (var offset = 0; offset < nWordsReady; offset += blockSize) {
			                    this._doProcessBlock(dataWords, offset);
			                }
			                processedWords = dataWords.splice(0, nWordsReady);
			                data.sigBytes -= nBytesReady;
			            }
			            return new WordArray.init(processedWords, nBytesReady);
			        },
			        clone: function () {
			            var clone = Base.clone.call(this);
			            clone._data = this._data.clone();
			            return clone;
			        },
			        _minBufferSize: 0
			    });
			    C_lib.Hasher = BufferedBlockAlgorithm.extend({
			        cfg: Base.extend(),
			        init: function (cfg) {
			            this.cfg = this.cfg.extend(cfg);
			            this.reset();
			        },
			        reset: function () {
			            BufferedBlockAlgorithm.reset.call(this);
			            this._doReset();
			        },
			        update: function (messageUpdate) {
			            this._append(messageUpdate);
			            this._process();
			            return this;
			        },
			        finalize: function (messageUpdate) {
			            if (messageUpdate) {
			                this._append(messageUpdate);
			            }
			            var hash = this._doFinalize();
			            return hash;
			        },
			        blockSize: 512/32,
			        _createHelper: function (hasher) {
			            return function (message, cfg) {
			                return new hasher.init(cfg).finalize(message);
			            };
			        },
			        _createHmacHelper: function (hasher) {
			            return function (message, key) {
			                return new C_algo.HMAC.init(hasher, key).finalize(message);
			            };
			        }
			    });
			    var C_algo = C.algo = {};
			    return C;
			}(Math));
			return CryptoJS;
		}));
	} (core));
	return core.exports;
}

(function (module, exports) {
(function (root, factory) {
		{
			module.exports = factory(requireCore());
		}
	}(commonjsGlobal, function (CryptoJS) {
		(function () {
		    var C = CryptoJS;
		    var C_lib = C.lib;
		    var WordArray = C_lib.WordArray;
		    var Hasher = C_lib.Hasher;
		    var C_algo = C.algo;
		    var W = [];
		    var SHA1 = C_algo.SHA1 = Hasher.extend({
		        _doReset: function () {
		            this._hash = new WordArray.init([
		                0x67452301, 0xefcdab89,
		                0x98badcfe, 0x10325476,
		                0xc3d2e1f0
		            ]);
		        },
		        _doProcessBlock: function (M, offset) {
		            var H = this._hash.words;
		            var a = H[0];
		            var b = H[1];
		            var c = H[2];
		            var d = H[3];
		            var e = H[4];
		            for (var i = 0; i < 80; i++) {
		                if (i < 16) {
		                    W[i] = M[offset + i] | 0;
		                } else {
		                    var n = W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16];
		                    W[i] = (n << 1) | (n >>> 31);
		                }
		                var t = ((a << 5) | (a >>> 27)) + e + W[i];
		                if (i < 20) {
		                    t += ((b & c) | (~b & d)) + 0x5a827999;
		                } else if (i < 40) {
		                    t += (b ^ c ^ d) + 0x6ed9eba1;
		                } else if (i < 60) {
		                    t += ((b & c) | (b & d) | (c & d)) - 0x70e44324;
		                } else  {
		                    t += (b ^ c ^ d) - 0x359d3e2a;
		                }
		                e = d;
		                d = c;
		                c = (b << 30) | (b >>> 2);
		                b = a;
		                a = t;
		            }
		            H[0] = (H[0] + a) | 0;
		            H[1] = (H[1] + b) | 0;
		            H[2] = (H[2] + c) | 0;
		            H[3] = (H[3] + d) | 0;
		            H[4] = (H[4] + e) | 0;
		        },
		        _doFinalize: function () {
		            var data = this._data;
		            var dataWords = data.words;
		            var nBitsTotal = this._nDataBytes * 8;
		            var nBitsLeft = data.sigBytes * 8;
		            dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - nBitsLeft % 32);
		            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] = Math.floor(nBitsTotal / 0x100000000);
		            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 15] = nBitsTotal;
		            data.sigBytes = dataWords.length * 4;
		            this._process();
		            return this._hash;
		        },
		        clone: function () {
		            var clone = Hasher.clone.call(this);
		            clone._hash = this._hash.clone();
		            return clone;
		        }
		    });
		    C.SHA1 = Hasher._createHelper(SHA1);
		    C.HmacSHA1 = Hasher._createHmacHelper(SHA1);
		}());
		return CryptoJS.SHA1;
	}));
} (sha1));
var sha1Exports = sha1.exports;
var SHA1 = getDefaultExportFromCjs(sha1Exports);

/**
 * Calculates SHA1 checksum for patch.
 *
 * @param content Content to hash.
 *
 * @returns SHA1 checksum for patch.
 */
const calculateChecksumSHA1 = (content) => {
    const res = SHA1(content);
    return res.toString();
};

const DIFF_PATH_TAG = 'Diff-Path';

/**
 * Type of diff change.
 */
const TypesOfChanges = {
    Add: 'a',
    Delete: 'd',
};

/**
 * @file
 * This file describes how to work with the `diff` directive.
 *
 * Format:
 * ```
 * diff name:[name] checksum:[checksum] lines:[lines].
 * ```
 *
 * - `name`: Name of the corresponding filter list. Mandatory when a resource
 * name is specified in the list.
 * - `checksum`: The expected SHA1 checksum of the file after the patch
 * is applied. Used to validate the patch.
 * - `lines`: The number of lines that follow, making up the RCS diff block.
 * Line count is determined using the same algorithm as `wc -l`, counting
 * newline characters '\n'.
 *
 * The `diff` directive is optional. If not specified, the patch is applied without validation.
 *
 * @see @link [Diff Files Format](https://github.com/ameshkov/diffupdates?tab=readme-ov-file#diff-files-format)
 */
const DIFF_DIRECTIVE = 'diff';
const DIFF_DIRECTIVE_NAME = 'name';
const DIFF_DIRECTIVE_CHECKSUM = 'checksum';
const DIFF_DIRECTIVE_LINE = 'lines';
/**
 * Parses a string to extract a Diff Directive object.
 *
 * @param s The string to parse.
 * @returns A Diff Directive object if the string is a valid diff directive,
 * otherwise null.
 */
const parseDiffDirective = (s) => {
    if (!s.startsWith(DIFF_DIRECTIVE)) {
        return null;
    }
    const parts = s
        .split(' ')
        // skip 'diff'
        .slice(1);
    const nameExists = parts[0].startsWith(DIFF_DIRECTIVE_NAME);
    if (nameExists) {
        return {
            name: parts[0].slice(`${DIFF_DIRECTIVE_NAME}:`.length),
            checksum: parts[1].slice(`${DIFF_DIRECTIVE_CHECKSUM}:`.length),
            lines: Number(parts[2].slice(`${DIFF_DIRECTIVE_LINE}:`.length)),
        };
    }
    return {
        checksum: parts[0].slice(`${DIFF_DIRECTIVE_CHECKSUM}:`.length),
        lines: Number(parts[1].slice(`${DIFF_DIRECTIVE_LINE}:`.length)),
    };
};

/* eslint-disable jsdoc/require-description-complete-sentence */
/**
 * @file
 * This file describes how to work with the patch file name.
 *
 * The Diff-Path also encodes additional information in the file name:
 *
 * <patchName>[-<resolution>]-<epochTimestamp>-<expirationPeriod>.patch[#<resourceName>]
 *
 * `patchName` - The name of the patch file, an arbitrary string to identify
 * the patch.
 * `epochTimestamp` - The epoch timestamp when the patch was generated (the unit
 * of that timestamp depends on the resolution, see below).
 * `expirationPeriod` - The expiration time for the diff update (the unit depends
 * on the resolution, see below).
 * `resolution` - An optional field that specifies the resolution for both
 * `expirationPeriod` and `epochTimestamp`. It can be either 'h' (hours),
 * 'm' (minutes), or 's' (seconds). If `resolution` is not specified,
 * it is assumed to be 'h'.
 * `resourceName` - The name of the resource that is being patched. This is used
 * to support batch updates, see the [Batch Updates](https://github.com/ameshkov/diffupdates?tab=readme-ov-file#batch-updates)
 * section for more details.
 *
 * @see {@link https://github.com/ameshkov/diffupdates?tab=readme-ov-file#-diff-path}
 */
/* eslint-enable jsdoc/require-description-complete-sentence */
/**
 * The file extension used for patch files.
 */
const FILE_EXTENSION = '.patch';
const MS_IN_SECONDS = 1000;
const MS_IN_MINUTES = MS_IN_SECONDS * 60;
const MS_IN_HOURS = MS_IN_MINUTES * 60;
/**
 * Enumeration representing different resolutions for timestamp generation.
 */
const Resolution = {
    Hours: 'h',
    Minutes: 'm',
    Seconds: 's',
};
/**
 * Throws an error for unexpected values.
 *
 * @param x The unexpected value.
 *
 * @throws Always throws an error with a message indicating an unexpected value.
 */
const assertNever = (x) => {
    throw new Error(`Unexpected value in resolution: ${x}`);
};
/**
 * Converts a timestamp to milliseconds based on the specified resolution.
 *
 * @param timestamp The timestamp to convert.
 * @param resolution The desired resolution for the timestamp (Minutes, Seconds, or Hours).
 *
 * @returns The timestamp in milliseconds.
 *
 * @throws {Error} If an unexpected resolution is provided.
 */
const timestampWithResolutionToMs = (timestamp, resolution) => {
    switch (resolution) {
        case Resolution.Hours:
            return timestamp * MS_IN_HOURS;
        case Resolution.Minutes:
            return timestamp * MS_IN_MINUTES;
        case Resolution.Seconds:
            return timestamp * MS_IN_SECONDS;
        default:
            return assertNever(resolution);
    }
};
/**
 * Parses a patch name into its components.
 *
 * @param patchName - The patch name to parse.
 *
 * @returns An object containing the parsed components of the patch name.
 *
 * @throws Error if the patch name cannot be parsed.
 */
const parsePatchName = (patchName) => {
    const parts = patchName
        .slice(0, -FILE_EXTENSION.length)
        .split('-');
    // Long variant
    if (parts.length === 4) {
        const [name, parsedResolution, parsedEpochTimestamp, parsedTime,] = parts;
        if (!(Object.values(Resolution)).includes(parsedResolution)) {
            throw new Error(`Unrecognized resolution in patch name: ${patchName}`);
        }
        return {
            name,
            resolution: parsedResolution,
            epochTimestamp: Number.parseInt(parsedEpochTimestamp, 10),
            time: Number.parseInt(parsedTime, 10),
        };
    }
    // Short variant with a default resolution value
    if (parts.length === 3) {
        const [name, parsedEpochTimestamp, parsedTime,] = parts;
        const resolution = Resolution.Hours;
        return {
            name,
            resolution,
            epochTimestamp: Number.parseInt(parsedEpochTimestamp, 10),
            time: Number.parseInt(parsedTime, 10),
        };
    }
    throw new Error(`Cannot parse the patch name: ${patchName}`);
};

/**
 * Split a string by lines while preserving line breaks within the original lines.
 *
 * @param s The input string to split.
 *
 * @returns An array of strings where each element is a complete line of text,
 * including its line break.
 */
const splitByLines = (s) => {
    // It will save end of lines inside splitted strings.
    return s.split(/(?<=\r?\n)/);
};

/**
 * Creates a logger function with the specified "verbose" setting.
 *
 * @param verbose A flag indicating whether to output messages.
 *
 * @returns Function for logging messages.
 */
const createLogger = (verbose) => {
    return (message) => {
        if (verbose) {
            // eslint-disable-next-line no-console
            console.log(message);
        }
    };
};

/**
 * Checks if error has message.
 *
 * @param error Error object.
 * @returns If param is error.
 */
function isErrorWithMessage(error) {
    return (typeof error === 'object'
        && error !== null
        && 'message' in error
        && typeof error.message === 'string');
}
/**
 * Converts error to the error with message.
 *
 * @param maybeError Possible error.
 * @returns Error with message.
 */
function toErrorWithMessage(maybeError) {
    if (isErrorWithMessage(maybeError)) {
        return maybeError;
    }
    try {
        return new Error(JSON.stringify(maybeError));
    }
    catch {
        // fallback in case there's an error stringifying the maybeError
        // like with circular references for example.
        return new Error(String(maybeError));
    }
}
/**
 * Converts error object to error with message. This method might be helpful to handle thrown errors.
 *
 * @param error Error object.
 *
 * @returns Message of the error.
 */
function getErrorMessage(error) {
    return toErrorWithMessage(error).message;
}

// Lines of filter metadata to parse
const AMOUNT_OF_LINES_TO_PARSE = 50;
/**
 * Finds value of specified header tag in filter rules text.
 *
 * @param tagName Filter header tag name.
 * @param rules Lines of filter rules text.
 *
 * @returns Trimmed value of specified header tag or null if tag not found.
 */
const parseTag = (tagName, rules) => {
    // Look up no more than 50 first lines
    const maxLines = Math.min(AMOUNT_OF_LINES_TO_PARSE, rules.length);
    for (let i = 0; i < maxLines; i += 1) {
        const rule = rules[i];
        if (!rule) {
            continue;
        }
        const search = `! ${tagName}: `;
        const indexOfSearch = rule.indexOf(search);
        if (indexOfSearch >= 0) {
            return rule.substring(indexOfSearch + search.length).trim();
        }
    }
    return null;
};

const ERROR_NAME = 'UnacceptableResponseError';
/**
 * Customized error class for unacceptable responses for patch requests.
 */
class UnacceptableResponseError extends Error {
    /**
     * Constructs a new `UnacceptableResponseError` instance.
     *
     * @param message Error message.
     */
    constructor(message) {
        super(message);
        this.name = ERROR_NAME;
        // For proper work of the "instanceof" operator
        Object.setPrototypeOf(this, UnacceptableResponseError.prototype);
    }
}

/**
 * If the differential update is not available the server may signal about that
 * by returning one of the following responses.
 *
 * @see @link Step 3 in https://github.com/ameshkov/diffupdates?tab=readme-ov-file#algorithm
 */
const AcceptableHttpStatusCodes = {
    NotFound: 404,
    NoContent: 204,
    Ok: 200,
};
/**
 * Parses an RCS (Revision Control System) operation string into an object
 * containing operation details.
 *
 * @param rcsOperation The RCS operation string to parse.
 *
 * @returns An object with the parsed operation details.
 *
 * @throws Throws an error if the operation string is not valid.
 */
const parseRcsOperation = (rcsOperation) => {
    const [operationInfo, operationCounter] = rcsOperation.split(' ');
    const typeOfOperation = operationInfo[0];
    // Indexes in RCS are natural so we need to subtract 1.
    const startIndex = Number(operationInfo.slice(1)) - 1;
    const numberOfLines = Number(operationCounter);
    if (typeOfOperation !== TypesOfChanges.Add && typeOfOperation !== TypesOfChanges.Delete) {
        throw new Error(`Operation is not valid: cannot parse type: ${rcsOperation}`);
    }
    if (Number.isNaN(startIndex)) {
        throw new Error(`Operation is not valid: cannot parse index: ${rcsOperation}`);
    }
    if (Number.isNaN(numberOfLines)) {
        throw new Error(`Operation is not valid: cannot parse number of lines: ${rcsOperation}`);
    }
    return {
        typeOfOperation,
        startIndex,
        numberOfLines,
    };
};
/**
 * Applies an RCS (Revision Control System) patch to a filter content.
 *
 * @param filterContent An array of strings representing the original filter content.
 * @param patch An array of strings representing the RCS patch to apply.
 * @param checksum An optional checksum to validate the updated filter content.
 * @returns The updated filter content after applying the patch.
 * @throws If the provided checksum doesn't match the calculated checksum.
 */
const applyRcsPatch = (filterContent, patch, checksum) => {
    // Make a copy
    const lines = filterContent.slice();
    // NOTE: Note that the line indices start always refer to the text which is
    // transformed as it is in its original state, without taking the precending
    // changes into account, so we need to collect "virtual offset" between
    // "current changing" file and "old file".
    let currentOffset = 0;
    for (let index = 0; index < patch.length; index += 1) {
        const patchLine = patch[index];
        // Skip empty lines
        if (patchLine === '') {
            continue;
        }
        const parsedRcsOperation = parseRcsOperation(patchLine);
        const { typeOfOperation, startIndex, numberOfLines, } = parsedRcsOperation;
        const startIndexWithOffset = startIndex + currentOffset;
        if (typeOfOperation === TypesOfChanges.Delete) {
            lines.splice(startIndexWithOffset, numberOfLines);
            currentOffset -= numberOfLines;
        }
        if (typeOfOperation === TypesOfChanges.Add) {
            const stringsToAdd = [];
            let nStringsToAdd = numberOfLines;
            // Scan strings to add starting from the second line.
            let scanFrom = index + 1;
            while (nStringsToAdd > 0 && scanFrom < patch.length) {
                stringsToAdd.push(patch[scanFrom]);
                scanFrom += 1;
                nStringsToAdd -= 1;
            }
            index += stringsToAdd.length;
            if (startIndexWithOffset < 0) {
                lines.unshift(...stringsToAdd);
            }
            else if (startIndexWithOffset > lines.length) {
                lines.push(...stringsToAdd);
            }
            else {
                lines.splice(startIndexWithOffset + 1, 0, ...stringsToAdd);
            }
            currentOffset += numberOfLines;
        }
    }
    const updatedFilter = lines.join('');
    if (checksum) {
        const c = calculateChecksumSHA1(updatedFilter);
        if (c !== checksum) {
            throw new Error('Checksums are not equal.');
        }
    }
    return updatedFilter;
};
/**
 * Checks if a patch has expired based on its timestamp and time-to-live (TTL).
 *
 * @param diffPath - The path of the patch file.
 * @returns `true` if the patch has expired, `false` otherwise.
 */
const checkPatchExpired = (diffPath) => {
    const { resolution, epochTimestamp, time, } = parsePatchName(diffPath);
    const createdMs = timestampWithResolutionToMs(epochTimestamp, resolution);
    const ttlMs = timestampWithResolutionToMs(time, resolution);
    return Date.now() > createdMs + ttlMs;
};
/**
 * Downloads a file from a specified URL and returns its content as a string.
 *
 * @param baseURL The base URL of the file.
 * @param fileUrl The URL from which to download the file.
 * @param isFileHostedViaNetworkProtocol Indicates whether the file is hosted
 * via a network protocol (http/https).
 * If `isFileHostedViaNetworkProtocol` is `true`, the function accepts HTTP
 * status codes based on the `AcceptableHttpStatusCodes` enumeration.
 * If `isFileHostedViaNetworkProtocol` is `false`, only 2xx status codes are
 * accepted, indicating a successful local or similar file request.
 * Any other status codes result in an error.
 * @param isRecursiveUpdate Indicates whether the function is called recursively.
 * @param log A function that logs a message.
 *
 * @returns A promise that resolves to the content of the downloaded file
 * as a string.
 *
 * @throws
 * 1. An {@link Error} if:
 *      - there is an error during the network request,
 *      - the file is not found,
 *      - or the file is empty.
 * 2. The {@link UnacceptableResponseError} if network-hosted file request
 * returns an unacceptable status code, e.g. 403.
 */
const downloadFile = async (baseURL, fileUrl, isFileHostedViaNetworkProtocol, isRecursiveUpdate, log) => {
    try {
        const response = await fetch(new URL(fileUrl, `${baseURL}/`));
        // For local and similar files, accept only 2xx status codes.
        if (!isFileHostedViaNetworkProtocol && !(response.status >= 200 && response.status < 300)) {
            log(`Error during file request: ${response.status} ${response.statusText}`);
            return null;
        }
        // For network-hosted files, accept status codes defined in AcceptableHttpStatusCodes.
        if (isFileHostedViaNetworkProtocol) {
            const acceptableHttpStatusCodes = Object.values(AcceptableHttpStatusCodes);
            if (!acceptableHttpStatusCodes.includes(response.status)) {
                const err = `Unacceptable response for network request: ${response.status} ${response.statusText}`;
                log(err);
                throw new UnacceptableResponseError(err);
            }
        }
        if ((response.status === AcceptableHttpStatusCodes.NotFound
            || response.status === AcceptableHttpStatusCodes.NoContent) && !isRecursiveUpdate) {
            log('Update is not available.');
            return null;
        }
        const data = await response.text();
        if (response.status === AcceptableHttpStatusCodes.Ok && data === '') {
            if (!isRecursiveUpdate) {
                log('Update is not available.');
            }
            return null;
        }
        return splitByLines(data);
    }
    catch (e) {
        // We ignore errors for local files
        if (!isFileHostedViaNetworkProtocol) {
            log(`Error during file request to "${baseURL}"/"${fileUrl}": ${getErrorMessage(e)}`);
            return null;
        }
        if (e instanceof UnacceptableResponseError) {
            // re-throw the error as is
            throw e;
        }
        throw new Error(`Error during network request: ${getErrorMessage(e)}`, { cause: e });
    }
};
/**
 * Extracts the base URL or directory path from a given URL or file path.
 * It identifies the appropriate delimiter (forward slash '/' for URLs and
 * POSIX file paths, or backslash '\' for Windows file paths), splits the string
 * using this delimiter, and then rejoins the parts excluding the last segment.
 * This effectively removes the file name or the last part of the path,
 * returning only the base path.
 *
 * @param filterUrl The URL or file path from which to extract the base.
 *
 * @returns The base URL or directory path without the last segment.
 */
const extractBaseUrl = (filterUrl) => {
    let splitDelimeter = '/';
    if (filterUrl.includes('\\')) {
        splitDelimeter = '\\';
    }
    // Remove the last part of the URL, which is the file name, and replace
    // it with the patch name because the patch name is relative to the filter URL.
    return filterUrl
        .split(splitDelimeter)
        .slice(0, -1)
        .join(splitDelimeter);
};
/**
 * Applies an RCS (Revision Control System) patch to update a filter's content.
 *
 * @param params The parameters for applying the patch {@link ApplyPatchParams}.
 *
 * @returns A promise that resolves to the updated filter content after applying the patch,
 * or null if there is no Diff-Path tag in the filter.
 *
 * @throws
 * 1. An {@link Error} if there is an error during
 *     - the patch application process
 *     - during network request.
 * 2. The {@link UnacceptableResponseError} if the network request returns an unacceptable status code.
 */
const applyPatch = async (params) => {
    // Wrapper to hide the callStack parameter from the user.
    const applyPatchWrapper = async (innerParams) => {
        const { filterUrl, filterContent, verbose = false, callStack, } = innerParams;
        const filterLines = splitByLines(filterContent);
        // Remove resourceName part after "#" sign if it exists.
        const diffPath = parseTag(DIFF_PATH_TAG, filterLines)?.split('#')[0];
        if (!diffPath) {
            return null;
        }
        // If the patch has not expired yet, return the filter content without changes.
        if (!checkPatchExpired(diffPath)) {
            return filterContent;
        }
        const log = createLogger(verbose);
        let patch = [];
        try {
            const baseUrl = extractBaseUrl(filterUrl);
            const res = await downloadFile(baseUrl, diffPath, baseUrl.startsWith('http://') || baseUrl.startsWith('https://'), callStack > 0, log);
            // Update is not available yet.
            if (res === null) {
                return filterContent;
            }
            patch = res;
        }
        catch (e) {
            if (e instanceof UnacceptableResponseError) {
                // re-throw the error as is
                throw e;
            }
            // eslint-disable-next-line max-len
            throw new Error(`Error during downloading patch file from "${diffPath}": ${getErrorMessage(e)}`, { cause: e });
        }
        let updatedFilter = '';
        try {
            const diffDirective = parseDiffDirective(patch[0]);
            updatedFilter = applyRcsPatch(filterLines, 
            // Remove the diff directive if it exists in the patch.
            diffDirective ? patch.slice(1) : patch, diffDirective ? diffDirective.checksum : undefined);
        }
        catch (e) {
            throw new Error(`Error during applying the patch from "${diffPath}": ${getErrorMessage(e)}`, { cause: e });
        }
        try {
            const recursiveUpdatedFilter = await applyPatchWrapper({
                filterUrl,
                filterContent: updatedFilter,
                callStack: callStack + 1,
                verbose,
            });
            // It can be null if the filter dropped support for Diff-Path in new versions.
            if (recursiveUpdatedFilter === null) {
                // Then we return the filter with the last successfully applied patch.
                return updatedFilter;
            }
            return recursiveUpdatedFilter;
        }
        catch (e) {
            // If we catch an error during the recursive update, we will return
            // the last successfully applied patch.
            return updatedFilter;
        }
    };
    return applyPatchWrapper(Object.assign(params, { callStack: 0 }));
};

const DiffUpdater = {
    applyPatch,
};

export { DiffUpdater, UnacceptableResponseError };
