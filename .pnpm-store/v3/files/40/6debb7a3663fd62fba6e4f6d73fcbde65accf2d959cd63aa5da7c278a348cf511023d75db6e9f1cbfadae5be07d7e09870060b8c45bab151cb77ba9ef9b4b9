'use strict';

var Ajv = require('ajv');
var addKeywords = require('..');
var addPatch = require('../keywords/patch');
var test = require('./test_validate');

describe('keyword $patch', function() {
  var ajvInstances;

  beforeEach(function() {
    ajvInstances = [ new Ajv, new Ajv ];
    addKeywords(ajvInstances[0]);
    addPatch(ajvInstances[1]);
  });

  it('should extend schema defined in $patch', function() {
    ajvInstances.forEach(testPatch);

    function testPatch(ajv) {
      var schema = {
        "$patch": {
          "source": {
            "type": "object",
            "properties": { "p": { "type": "string" } },
            "additionalProperties": false,
            "required": [ "p" ]
          },
          "with": [
            { "op": "add", "path": "/properties/q", "value": { "type": "number" } },
            { "op": "add", "path": "/required/-", "value": "q" }
          ]
        }
      };

      var validate = ajv.compile(schema);
      test(validate, '$patch');
    }
  });

  it('should extend schema defined in $ref', function() {
    ajvInstances.forEach(testPatch);

    function testPatch(ajv) {
      var sourceSchema = {
        "$id": "obj.json#",
        "type": "object",
        "properties": { "p": { "type": "string" } },
        "additionalProperties": false,
        "required": [ "p" ]
      };

      ajv.addSchema(sourceSchema);

      var schema = {
        "$patch": {
          "source": { "$ref": "obj.json#" },
          "with": [
            { "op": "add", "path": "/properties/q", "value": { "type": "number" } },
            { "op": "add", "path": "/required/-", "value": "q" }
          ]
        }
      };

      var validate = ajv.compile(schema);
      test(validate, '$patch');
    }
  });

  it('should extend schema defined with relative $ref', function() {
    ajvInstances.forEach(testPatch);

    function testPatch(ajv) {
      var schema = {
        "$id": "obj.json#",
        "definitions": {
          "source": {
            "type": "object",
            "properties": { "p": { "type": "string" } },
            "additionalProperties": false,
            "required": [ "p" ]
          }
        },
        "$patch": {
          "source": { "$ref": "#/definitions/source" },
          "with": [
            { "op": "add", "path": "/properties/q", "value": { "type": "number" } },
            { "op": "add", "path": "/required/-", "value": "q" }
          ]
        }
      };

      var validate = ajv.compile(schema);
      test(validate, '$patch');
    }
  });
});
