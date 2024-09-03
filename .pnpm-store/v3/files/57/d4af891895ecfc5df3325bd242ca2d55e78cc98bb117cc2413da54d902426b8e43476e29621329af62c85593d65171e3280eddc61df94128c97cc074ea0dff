'use strict';

var Ajv = require('ajv');
var addKeywords = require('..');
var assert = require('assert');

describe('errors', function() {
  var ajv;

  describe('missing $ref', function() {
    beforeEach(function() {
      ajv = new Ajv;
      addKeywords(ajv);
    });

    it('should throw exception if cannot resolve $ref', function() {
      var schema = {
        "$merge": {
          "source": { "$ref": "obj.json#" },
          "with": {
            "properties": { "q": { "type": "number" } }
          }
        }
      };

      assert.throws(function() {
        ajv.compile(schema);
      });
    });
  });
});
