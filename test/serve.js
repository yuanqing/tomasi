'use strict';

var tomasi = require('..');

var fs = require('fs-extra');
var join = require('path').join;
var test = require('tape');
var request = require('request');

test('throws if `$outDir` not found', function(t) {
  t.false(fs.existsSync('out'));
  t.throws(function() {
    tomasi({}).serve();
  });
  t.end();
});

var setUp = function(t) {
  t.false(fs.existsSync('out'));
  var file = join('out', 'foo.txt');
  fs.outputFileSync(file, 'foo');
  t.true(fs.existsSync(file));
};

var tearDown = function(t) {
  fs.removeSync('out');
  t.false(fs.existsSync('out'));
};

test('serves the `$outDir` on port 8888', function(t) {
  setUp(t);
  var server = tomasi({}).serve();
  request('http://localhost:8888/foo.txt', function(err, res, body) {
    tearDown(t);
    server.close();
    if (err || res.statusCode !== 200) {
      t.fail();
    } else {
      t.equal(body, 'foo');
    }
    t.end();
  }).on('error', function() {
    tearDown(t);
    server.close();
    t.fail();
    t.end();
  });
});
