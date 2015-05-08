'use strict';

var tomasi = require('..');

var bufferEqual = require('buffer-equal');
var fs = require('fs');
var test = require('tape');

var inDir = __dirname + '/fixtures/';

test('is a function', function(t) {
  t.equal(typeof tomasi, 'function');
  t.end();
});

test('throws if no `config` or `cb`', function(t) {
  t.throws(function() {
    tomasi();
  });
  t.throws(function() {
    tomasi({});
  });
  t.end();
});

test('calls `cb` with an `err` if no files match an `in` pattern', function(t) {
  var calls = [];
  var x = function(cb) {
    calls.push(1);
    cb();
  };
  var config = {
    blog: {
      in: 'invalid/*.txt',
      out: {
        post: [
          [ x ],
        ]
      }
    }
  };
  t.false(fs.existsSync('invalid'));
  tomasi(config, function(err) {
    t.true(err);
    t.looseEqual(calls, []);
    t.end();
  });
});

test('can read utf8 files', function(t) {
  var calls = [];
  var x = function(cb, files, dataTypeName, viewName, dataTypes) {
    calls.push(1);
    var expectedFiles = [
      { $inPath: inDir + '1-foo.txt', $content: 'foo' },
      { $inPath: inDir + '2-bar.txt', $content: 'bar' },
      { $inPath: inDir + '3-baz.txt', $content: 'baz' }
    ];
    var expectedDataTypes = {
      blog: {
        single: expectedFiles
      }
    };
    t.equal(arguments.length, 5);
    t.deepEqual(files, expectedFiles);
    t.equal(dataTypeName, 'blog');
    t.equal(viewName, 'single');
    t.deepEqual(dataTypes, expectedDataTypes);
    t.equal(files, dataTypes.blog.single);
    cb();
  };
  var config = {
    blog: {
      in: inDir + '*.txt',
      out: {
        single: [
          [ x ]
        ]
      }
    }
  };
  tomasi(config, function(err) {
    t.false(err);
    t.looseEquals(calls, [1]);
    t.end();
  });
});

test('can read not-utf8 files', function(t) {
  var calls = [];
  var x = function(cb, files, dataTypeName, viewName, dataTypes) {
    calls.push(1);
    var inFile = inDir + 'heart.png';
    var img = fs.readFileSync(inFile);
    t.equal(arguments.length, 5);
    t.equal(files.length, 1);
    t.equal(files[0].$inPath, inFile);
    t.true(bufferEqual(files[0].$content, img));
    t.equal(dataTypeName, 'images');
    t.equal(viewName, 'single');
    t.equal(files, dataTypes.images.single);
    cb();
  };
  var config = {
    images: {
      in: inDir + '*.png',
      out: {
        single: [
          [ x ]
        ]
      }
    }
  };
  tomasi(config, function(err) {
    t.false(err);
    t.looseEquals(calls, [1]);
    t.end();
  });
});

test('if not specified, `viewName` defaults to "_"', function(t) {
  var calls = [];
  var x = function(cb, files, dataTypeName, viewName, dataTypes) {
    calls.push(1);
    var expectedFiles = [
      { $inPath: inDir + '1-foo.txt', $content: 'foo' },
      { $inPath: inDir + '2-bar.txt', $content: 'bar' },
      { $inPath: inDir + '3-baz.txt', $content: 'baz' }
    ];
    var expectedDataTypes = {
      blog: {
        _: expectedFiles
      }
    };
    t.equal(arguments.length, 5);
    t.deepEqual(files, expectedFiles);
    t.equal(dataTypeName, 'blog');
    t.equal(viewName, '_');
    t.deepEqual(dataTypes, expectedDataTypes);
    t.equal(files, dataTypes.blog._);
    cb();
  };
  var config = {
    blog: {
      in: inDir + '*.txt',
      out: [ x ]
    }
  };
  tomasi(config, function(err) {
    t.false(err);
    t.looseEquals(calls, [1]);
    t.end();
  });
});

test('calls plugins in a single pipeline in series', function(t) {
  var calls = [];
  var x = function(cb) {
    calls.push(1);
    setTimeout(function() {
      calls.push(2);
      cb(null, 'hello');
    }, 20);
  };
  var y = function(cb, files, dataTypeName, viewName, dataTypes) {
    calls.push(3);
    t.equals(files, 'hello');
    t.equals(dataTypes.blog.single, 'hello');
    setTimeout(function() {
      calls.push(4);
      cb();
    }, 10);
  };
  var config = {
    blog: {
      in: inDir + '*.txt',
      out: {
        single: [
          [ x, y ]
        ]
      }
    }
  };
  tomasi(config, function(err) {
    t.false(err);
    t.looseEquals(calls, [1, 2, 3, 4]);
    t.end();
  });
});

test('calls plugins in adjoining pipelines in series', function(t) {
  var calls = [];
  var x = function(cb) {
    calls.push(1);
    setTimeout(function() {
      calls.push(2);
      cb(null, 'hello');
    }, 20);
  };
  var y = function(cb, files, dataTypeName, viewName, dataTypes) {
    calls.push(3);
    t.equals(files, 'hello');
    t.equals(dataTypes.blog.single, 'hello');
    setTimeout(function() {
      calls.push(4);
      cb(null);
    }, 10);
  };
  var config = {
    blog: {
      in: inDir + '*.txt',
      out: {
        single: [
          [ x ],
          [ y ]
        ]
      }
    }
  };
  tomasi(config, function(err) {
    t.false(err);
    t.looseEquals(calls, [1, 2, 3, 4]);
    t.end();
  });
});

test('calls plugins in parallel pipelines in parallel', function(t) {
  var calls = [];
  var x = function(cb) {
    calls.push(1);
    setTimeout(function() {
      calls.push(3);
      cb();
    }, 20);
  };
  var y = function(cb) {
    calls.push(5);
    setTimeout(function() {
      calls.push(6);
      cb();
    }, 10);
  };
  var z = function(cb) {
    calls.push(2);
    setTimeout(function() {
      calls.push(4);
      cb();
    }, 30);
  };
  var config = {
    blog: {
      in: inDir + '*.txt',
      out: {
        single: [
          [ x ],
          [ y ]
        ],
        archive: [
          [ z ]
        ]
      }
    }
  };
  tomasi(config, function(err) {
    t.false(err);
    t.looseEquals(calls, [1, 2, 3, 4, 5, 6]);
    t.end();
  });
});
