'use strict';

var tomasi = require('..');

var test = require('tape');

test('is a function', function(t) {
  t.equal(typeof tomasi, 'function');
  t.end();
});

test('throws if no `config`', function(t) {
  t.throws(function() {
    tomasi();
  });
  t.end();
});

test('throws if `config` is not a string, function, or object', function(t) {
  t.throws(function() {
    tomasi([]);
  });
  t.end();
});
