'use strict';

var Ajv = require('ajv');
var addKeywords = require('..');
var addMerge = require('../keywords/merge');
var test = require('./test_validate');

describe('keyword $merge', function() {
  var ajvInstances;

  beforeEach(function() {
    ajvInstances = [ new Ajv, new Ajv ];
    addKeywords(ajvInstances[0]);
    addMerge(ajvInstances[1]);
  });

  it('should extend schema defined in $merge', function() {
    ajvInstances.forEach(testMerge);

    function testMerge(ajv) {
      var schema = {
        "$merge": {
          "source": {
            "type": "object",
            "properties": { "p": { "type": "string" } },
            "additionalProperties": false
          },
          "with": {
            "properties": { "q": { "type": "number" } },
            "required": [ "q" ]
          }
        }
      };

      var validate = ajv.compile(schema);
      test(validate, '$merge');
    }
  });

  it('should extend schema defined in $ref', function() {
    ajvInstances.forEach(testMerge);

    function testMerge(ajv) {
      var sourceSchema = {
        "$id": "obj.json#",
        "type": "object",
        "properties": { "p": { "type": "string" } },
        "additionalProperties": false
      };

      ajv.addSchema(sourceSchema);

      var schema = {
        "$merge": {
          "source": { "$ref": "obj.json#" },
          "with": {
            "properties": { "q": { "type": "number" } },
            "required": [ "q" ]
          }
        }
      };

      var validate = ajv.compile(schema);
      test(validate, '$merge');
    }
  });

  it('should extend schema defined with relative $ref', function() {
    ajvInstances.forEach(testMerge);

    function testMerge(ajv) {
      var schema = {
        "$id": "obj.json#",
        "definitions": {
          "source": {
            "type": "object",
            "properties": { "p": { "type": "string" } },
            "additionalProperties": false
          }
        },
        "$merge": {
          "source": { "$ref": "#/definitions/source" },
          "with": {
            "properties": { "q": { "type": "number" } },
            "required": [ "q" ]
          }
        }
      };

      var validate = ajv.compile(schema);
      test(validate, '$merge');
    }
  });

  it('should extend schema with patch in $ref', function() {
    ajvInstances.forEach(testMerge);

    function testMerge(ajv) {
      var sourceSchema = {
        "type": "object",
        "properties": { "p": { "type": "string" } },
        "additionalProperties": false,
        "required": [ "p" ]
      };

      var patchSchema = {
        "type": "object",
        "properties": { "q": { "type": "number" } },
        "additionalProperties": false,
        "required": [ "q" ]
      };

      ajv.addSchema(sourceSchema, "obj1.json#");
      ajv.addSchema(patchSchema, "obj2.json#");

      var schema = {
        "$merge": {
          "source": { "$ref": "obj1.json#" },
          "with": { "$ref": "obj2.json#" }
        }
      };

      var validate = ajv.compile(schema);
      test(validate, '$merge');
    }
  });

  it('should extend schema with patch defined with relative $ref', function() {
    ajvInstances.forEach(testMerge);

    function testMerge(ajv) {
      var sourceSchema = {
        "type": "object",
        "properties": { "p": { "type": "string" } },
        "additionalProperties": false
      };

      ajv.addSchema(sourceSchema, "obj1.json#");

      var schema = {
        "$id": "obj2.json#",
        "definitions": {
          "patch":{
            "type": "object",
            "properties": { "q": { "type": "number" } },
            "additionalProperties": false,
            "required" : [ "q" ]
          }
        },
        "$merge": {
          "source": { "$ref": "obj1.json#" },
          "with": { "$ref": "#/definitions/patch" }
        }
      };

      var validate = ajv.compile(schema);
      test(validate, '$merge');
    }
  });
});
