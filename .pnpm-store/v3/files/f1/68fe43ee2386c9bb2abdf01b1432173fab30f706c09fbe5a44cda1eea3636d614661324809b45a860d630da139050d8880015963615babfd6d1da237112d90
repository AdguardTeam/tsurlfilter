'use strict';

var Ajv = require('ajv');
var addKeywords = require('..');
var test = require('./test_validate');
var assert = require('assert');

describe('async schema loading', function() {
  var ajv, loadCount;

  beforeEach(function() {
    ajv = new Ajv({loadSchema: loadSchema});
    addKeywords(ajv);
    loadCount = 0;
  });

  describe('$merge', function() {
    it('should load missing schemas', function() {
      var schema = {
        "$merge": {
          "source": { "$ref": "obj.json#" },
          "with": {
            "properties": { "q": { "type": "number" } },
            "required": [ "q" ]
          }
        }
      };

      return testAsync(schema, '$merge');
    });
  });

  describe('$patch', function() {
    it('should load missing schemas', function() {
      var schema = {
        "$patch": {
          "source": { "$ref": "obj.json#" },
          "with": [
            { "op": "add", "path": "/properties/q", "value": { "type": "number" } },
            { "op": "add", "path": "/required/-", "value": "q" }
          ]
        }
      };

      return testAsync(schema, '$patch');
    });
  });

  function testAsync(schema, keyword) {
    return ajv.compileAsync(schema)
    .then(function (validate) {
      assert.strictEqual(loadCount, 1);
      test(validate, keyword);
    });
  }

  function loadSchema(ref) {
    if (ref == 'obj.json') {
      loadCount++;
      var schema = {
        "id": "obj.json#",
        "type": "object",
        "properties": { "p": { "type": "string" } },
        "additionalProperties": false,
        "required": [ "p" ]
      };
      return Promise.resolve(schema);
    }
    return Promise.reject(new Error('404: ' + ref));
  }
});
