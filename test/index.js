'use strict';

var tomasi = require('..');

var bufferEqual = require('buffer-equal');
var fs = require('fs');
var join = require('path').join;
var test = require('tape');

var fixturesDir = join(__dirname, 'fixtures/');
var configFile = join(fixturesDir, 'tomasi.js');

test('is a function', function(t) {
  t.equal(typeof tomasi, 'function');
  t.end();
});

test('throws if no arguments', function(t) {
  t.throws(function() {
    tomasi();
  });
  t.end();
});

test('throws if no `cb`', function(t) {
  t.throws(function() {
    tomasi({});
  });
  t.throws(function() {
    t.true(fs.existsSync(configFile));
    tomasi(configFile);
  });
  t.end();
});

test('throws if `cb` is not a function', function(t) {
  t.throws(function() {
    tomasi({}, {});
  });
  t.throws(function() {
    t.true(fs.existsSync(configFile));
    tomasi(configFile, {});
  });
  t.end();
});

test('throws if `configFile` does not exist', function(t) {
  var cb = function() {};
  t.throws(function() {
    t.false(fs.existsSync('tomasi.js'));
    tomasi(cb);
  });
  t.throws(function() {
    t.false(fs.existsSync('invalid'));
    tomasi('invalid', cb);
  });
  t.end();
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
      in: join('invalid', '*.txt'),
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

test('uses settings in the given `configFile`', function(t) {
  tomasi(configFile, function(err, dataTypes) {
    t.false(err);
    t.looseEquals(dataTypes.blog.single, [
      { $inPath: join(fixturesDir, '1-foo.txt'), $content: 'foo' },
      { $inPath: join(fixturesDir, '2-bar.txt'), $content: 'bar' },
      { $inPath: join(fixturesDir, '3-baz.txt'), $content: 'baz' }
    ]);
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
      in: join(fixturesDir, '*.txt'),
      out: {
        single: [
          [ x ]
        ]
      }
    }
  };
  tomasi(config, function(err) {
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
      in: join(fixturesDir, '*.png'),
      out: {
        single: [
          [ x ]
        ]
      }
    }
  };
  tomasi(config, function(err) {
    t.false(err);
    t.looseEquals(calls, [ 1 ]);
    t.end();
  });
});

test('if not specified, `viewName` defaults to "$"', function(t) {
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
        $: expectedFiles
      }
    };
    t.equal(arguments.length, 5);
    t.deepEqual(files, expectedFiles);
    t.equal(dataTypeName, 'blog');
    t.equal(viewName, '$');
    t.deepEqual(dataTypes, expectedDataTypes);
    t.equal(files, dataTypes.blog.$);
    cb();
  };
  var config = {
    blog: {
      in: join(fixturesDir, '*.txt'),
      out: [ x ]
    }
  };
  tomasi(config, function(err) {
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
      in: join(fixturesDir, '*.txt'),
      out: {
        single: [
          [ x, y ]
        ]
      }
    }
  };
  tomasi(config, function(err) {
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
      in: join(fixturesDir, '*.txt'),
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
      in: join(fixturesDir, '*.txt'),
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
    t.looseEquals(calls, [ 1, 2, 3, 4, 5, 6 ]);
    t.end();
  });
});
