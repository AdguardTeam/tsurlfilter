'use strict';

var assert = require('assert');

module.exports = function (validate, keyword) {
  assert.strictEqual(validate({ p: 'abc', q: 1 }), true);

  // property q should be a number
  assert.strictEqual(validate({ p: 'foo', q: 'bar' }), false);
  var errs = validate.errors;
  assert.equal(errs.length, 2);
  assert.equal(errs[0].keyword, 'type');
  assert.equal(errs[0].dataPath, '.q');
  assert.equal(errs[0].schemaPath, '#/properties/q/type');
  assert.equal(errs[1].keyword, keyword);
  assert.equal(errs[1].dataPath, '');
  assert.equal(errs[1].schemaPath, '#/' + keyword);

  // an object without q should fail
  assert.strictEqual(validate({ p: 'foo' }), false);
  errs = validate.errors;
  assert.equal(errs.length, 2);
  assert.equal(errs[0].keyword, 'required');
  assert.equal(errs[0].dataPath, '');
  assert.equal(errs[0].schemaPath, '#/required');
  assert.deepEqual(errs[0].params, { missingProperty: 'q' });
  assert.equal(errs[1].keyword, keyword);
  assert.equal(errs[1].dataPath, '');
  assert.equal(errs[1].schemaPath, '#/' + keyword);
};
