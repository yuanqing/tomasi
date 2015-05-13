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

test('serves the `$outDir` on port 8888', function(t) {
  var outDir = 'out';
  t.false(fs.existsSync(outDir));
  var file = join(outDir, 'foo.txt');
  fs.outputFileSync(file, 'foo');
  t.true(fs.existsSync(file));
  var server = tomasi({}).serve();
  request('http://localhost:8888/foo.txt', function(err, res, body) {
    fs.removeSync(outDir);
    t.false(fs.existsSync(outDir));
    server.close();
    if (err || res.statusCode !== 200) {
      t.fail();
    } else {
      t.equal(body, 'foo');
    }
    t.end();
  });
});
