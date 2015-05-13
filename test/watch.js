'use strict';

var tomasi = require('..');

var fs = require('fs');
var path = require('path');
var join = path.join;
var test = require('tape');

var RELATIVE_PATH = path.relative(process.cwd(), __dirname);
var FIXTURES_DIR = join(RELATIVE_PATH, 'fixtures');

test('errors on a build triggered by a file change', function(t) {
  var x = function(cb, files) {
    if (files.length === 4) {
      return cb('error');
    }
    cb();
  };
  var inPath = join(FIXTURES_DIR, '*.txt');
  var config = {
    $dataTypes: {
      blog: {
        $inPath: inPath,
        $preProcess: [ x ]
      }
    }
  };
  var newFile = join(FIXTURES_DIR, 'watch.txt');
  tomasi(config).watch(function(err) {
    t.equal(arguments.length, 1);
    t.equal(err, 'error');
    fs.unlinkSync(newFile);
    t.false(fs.existsSync(newFile));
    t.end();
  });
  setTimeout(function() {
    t.false(fs.existsSync(newFile));
    fs.writeFileSync(newFile, 'qux');
    t.true(fs.existsSync(newFile));
  }, 125);
});

test('no errors', function(t) {
  var inPath = join(FIXTURES_DIR, '*.txt');
  var config = {
    $dataTypes: {
      blog: {
        $inPath: inPath
      }
    }
  };
  var newFile = join(FIXTURES_DIR, 'watch.txt');
  tomasi(config).watch(function(err, dataTypes, watcher) {
    watcher.close();
    t.equal(arguments.length, 3);
    t.false(err);
    t.looseEquals(dataTypes.blog, [
      { $inPath: join(FIXTURES_DIR, '1-foo.txt'), $content: 'foo' },
      { $inPath: join(FIXTURES_DIR, '2-bar.txt'), $content: 'bar' },
      { $inPath: join(FIXTURES_DIR, '3-baz.txt'), $content: 'baz' },
      { $inPath: newFile, $content: 'qux' }
    ]);
    fs.unlinkSync(newFile);
    t.false(fs.existsSync(newFile));
    t.end();
  });
  setTimeout(function() {
    t.false(fs.existsSync(newFile));
    fs.writeFileSync(newFile, 'qux');
    t.true(fs.existsSync(newFile));
  }, 125);
});
