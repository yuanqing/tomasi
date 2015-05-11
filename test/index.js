'use strict';

var tomasi = require('..');

var bufferEqual = require('buffer-equal');
var fs = require('fs');
var join = require('path').join;
var test = require('tape');

var fixturesDir = join(__dirname, 'fixtures/');

test('is a function', function(t) {
  t.equal(typeof tomasi, 'function');
  t.end();
});

test('throws if `config` is not a string, function, or object', function(t) {
  t.throws(function() {
    tomasi([]);
  });
  t.end();
});

test('throws if `config` file does not exist', function(t) {
  t.throws(function() {
    var config = 'invalid';
    t.false(fs.existsSync(config));
    tomasi(config);
  });
  t.end();
});

test('uses settings in `tomasi.js`', function(t) {
  var prevDir = process.cwd();
  process.chdir(fixturesDir);
  t.true(fs.existsSync('tomasi.js'));
  tomasi().build(function(err, dataTypes) {
    t.false(err);
    t.looseEquals(dataTypes.blog.single, [
      { $inPath: join(fixturesDir, '1-foo.txt'), $content: 'foo' },
      { $inPath: join(fixturesDir, '2-bar.txt'), $content: 'bar' },
      { $inPath: join(fixturesDir, '3-baz.txt'), $content: 'baz' }
    ]);
    process.chdir(prevDir);
    t.end();
  });
});

test('uses settings in the given `config` file', function(t) {
  var config = join(fixturesDir, 'tomasi.js');
  t.true(fs.existsSync(config));
  tomasi(config).build(function(err, dataTypes) {
    t.false(err);
    t.looseEquals(dataTypes.blog.single, [
      { $inPath: join(fixturesDir, '1-foo.txt'), $content: 'foo' },
      { $inPath: join(fixturesDir, '2-bar.txt'), $content: 'bar' },
      { $inPath: join(fixturesDir, '3-baz.txt'), $content: 'baz' }
    ]);
    t.end();
  });
});

test('calls `cb` with an `err` if no files match an `in` pattern',
    function(t) {
  var calls = [];
  var x = function(cb) {
    calls.push(1);
    cb();
  };
  var config = {
    blog: {
      $in: join('invalid', '*.txt'),
      $views: {
        post: [
          [ x ],
        ]
      }
    }
  };
  t.false(fs.existsSync('invalid'));
  tomasi(config).build(function(err) {
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
      { $inPath: join(fixturesDir, '1-foo.txt'), $content: 'foo' },
      { $inPath: join(fixturesDir, '2-bar.txt'), $content: 'bar' },
      { $inPath: join(fixturesDir, '3-baz.txt'), $content: 'baz' }
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
      $in: join(fixturesDir, '*.txt'),
      $views: {
        single: [
          [ x ]
        ]
      }
    }
  };
  tomasi(config).build(function(err) {
    t.false(err);
    t.looseEquals(calls, [ 1 ]);
    t.end();
  });
});

test('can read non-utf8 files', function(t) {
  var calls = [];
  var x = function(cb, files, dataTypeName, viewName, dataTypes) {
    calls.push(1);
    var inFile = join(fixturesDir, 'heart.png');
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
      $in: join(fixturesDir, '*.png'),
      $views: {
        single: [
          [ x ]
        ]
      }
    }
  };
  tomasi(config).build(function(err) {
    t.false(err);
    t.looseEquals(calls, [ 1 ]);
    t.end();
  });
});

test('calls plugins in $preProcess pipelines in parallel', function(t) {
  var calls = [];
  var x = function(cb, files, dataTypeName, viewName, dataTypes) {
    calls.push(1);
    var expectedFiles = [
      { $inPath: join(fixturesDir, '1-foo.txt'), $content: 'foo' },
      { $inPath: join(fixturesDir, '2-bar.txt'), $content: 'bar' },
      { $inPath: join(fixturesDir, '3-baz.txt'), $content: 'baz' }
    ];
    var expectedDataTypes = {
      blog: expectedFiles
    };
    t.equal(arguments.length, 5);
    t.deepEqual(files, expectedFiles);
    t.equal(dataTypeName, 'blog');
    t.equal(viewName, null);
    t.deepEqual(dataTypes, expectedDataTypes);
    t.equal(files, dataTypes.blog);
    cb();
  };
  var config = {
    blog: {
      $in: join(fixturesDir, '*.txt'),
      $preProcess: [ x ]
    }
  };
  tomasi(config).build(function(err) {
    t.false(err);
    t.looseEquals(calls, [ 1 ]);
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
      $in: join(fixturesDir, '*.txt'),
      $views: {
        single: [
          [ x, y ]
        ]
      }
    }
  };
  tomasi(config).build(function(err) {
    t.false(err);
    t.looseEquals(calls, [ 1, 2, 3, 4 ]);
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
      $in: join(fixturesDir, '*.txt'),
      $views: {
        single: [
          [ x ],
          [ y ]
        ]
      }
    }
  };
  tomasi(config).build(function(err) {
    t.false(err);
    t.looseEquals(calls, [ 1, 2, 3, 4 ]);
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
      $in: join(fixturesDir, '*.txt'),
      $views: {
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
  tomasi(config).build(function(err) {
    t.false(err);
    t.looseEquals(calls, [ 1, 2, 3, 4, 5, 6 ]);
    t.end();
  });
});
