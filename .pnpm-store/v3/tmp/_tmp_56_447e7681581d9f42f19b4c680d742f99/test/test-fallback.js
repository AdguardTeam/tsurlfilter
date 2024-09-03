test(
    function () {
        /**
         The test checks that the TextEncoder.encode polyfill uses fallback in case if it encounters an unknown character code.
         The native TextEncoder.encode method never throws an error and to repeat this behavior,
         a fallback character needs to specified for the encoding in use
         */

        function testEncodeDecode(charset) {
            var encoder = new TextEncoder(charset, { NONSTANDARD_allowLegacyEncoding: true });
            var decoder = new TextDecoder(charset, { NONSTANDARD_allowLegacyEncoding: true });

            for (var i = 0; i < 65533; i++) {
                var bytes = encoder.encode(String.fromCharCode(i));
                decoder.decode(bytes);
                if (i <= 0x7F) {
                    assert_equals(i, bytes[0]);
                }
            }
        }

        testEncodeDecode('utf-8');
        testEncodeDecode('windows-1251');
        testEncodeDecode('windows-1252');

        // Some specific cases

        // Fallback to windows-1252
        var encoder = new TextEncoder('windows-1251', { NONSTANDARD_allowLegacyEncoding: true });
        var bytes = encoder.encode(String.fromCharCode(244));
        assert_equals(244, bytes[0]);

        // Fallback to replacement
        var testStr = String.fromCharCode(9416); // Ⓢ symbol
        assert_equals(63, encoder.encode(testStr)[0]);
    },
    "fallback"
);