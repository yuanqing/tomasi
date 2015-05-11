'use strict';

var tomasi = require('..');

var fs = require('fs');
var join = require('path').join;
var test = require('tape');

var FIXTURES_DIR = join(__dirname, 'fixtures/');

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

test('without `$preProcess` or `$views` pipelines', function(t) {
  var inPath = join(FIXTURES_DIR, '*.txt');
  var config = {
    blog: {
      $inPath: inPath
    }
  };
  tomasi(config).build(function(err, dataTypes) {
    t.false(err);
    t.looseEquals(dataTypes.blog, [
      { $inPath: join(FIXTURES_DIR, '1-foo.txt'), $content: 'foo' },
      { $inPath: join(FIXTURES_DIR, '2-bar.txt'), $content: 'bar' },
      { $inPath: join(FIXTURES_DIR, '3-baz.txt'), $content: 'baz' }
    ]);
    t.end();
  });
});

test('calls the build `cb` with an `err` if no files match an `$inPath`', function(t) {
  var calls = [];
  var x = function(cb) {
    calls.push(1);
    cb();
  };
  var y = function(cb) {
    calls.push(2);
    cb();
  };
  var inPath = join('invalid', '*.txt');
  var config = {
    blog: {
      $inPath: inPath,
      $preProcess: [ x ],
      $views: {
        single: [
          [ y ]
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

test('calls plugins in a single `$preProcess` pipeline in series', function(t) {
  var calls = [];
  var x = function(cb, files, dataTypeName, viewName, dataTypes) {
    calls.push(1);
    t.equal(arguments.length, 5);
    var expectedFiles = [
      { $inPath: join(FIXTURES_DIR, '1-foo.txt'), $content: 'foo' },
      { $inPath: join(FIXTURES_DIR, '2-bar.txt'), $content: 'bar' },
      { $inPath: join(FIXTURES_DIR, '3-baz.txt'), $content: 'baz' }
    ];
    t.deepEqual(files, expectedFiles);
    t.equal(dataTypeName, 'blog');
    t.equal(viewName, null);
    t.deepEqual(dataTypes, {
      blog: expectedFiles
    });
    t.true(files === dataTypes.blog);
    cb(null, ['kanade']);
  };
  var y = function(cb, files, dataTypeName, viewName, dataTypes) {
    calls.push(2);
    t.equal(arguments.length, 5);
    t.deepEqual(files, ['kanade']);
    t.equal(dataTypeName, 'blog');
    t.equal(viewName, null);
    t.deepEqual(dataTypes.blog, ['kanade']);
    cb();
  };
  var inPath = join(FIXTURES_DIR, '*.txt');
  var config = {
    blog: {
      $inPath: inPath,
      $preProcess: [ x, y ]
    }
  };
  tomasi(config).build(function(err) {
    t.false(err);
    t.looseEquals(calls, [ 1, 2 ]);
    t.end();
  });
});

test('calls the build `cb` with the `err` if a plugin in a `$preProcess` pipeline has an error', function(t) {
  var calls = [];
  var x = function(cb) {
    calls.push(1);
    cb();
  };
  var y = function(cb) {
    calls.push(2);
    cb('error');
  };
  var z = function(cb) {
    calls.push(3);
    cb();
  };
  var inPath = join(FIXTURES_DIR, '*.txt');
  var config = {
    blog: {
      $inPath: inPath,
      $preProcess: [ x, y, z ]
    }
  };
  tomasi(config).build(function(err) {
    t.equal(err, 'error');
    t.looseEquals(calls, [ 1, 2 ]);
    t.end();
  });
});

test('runs parallel `$preProcess` pipelines in parallel', function(t) {
  var calls = [];
  var x = function(cb) {
    calls.push(1);
    setTimeout(function() {
      calls.push(4);
      cb();
    }, 10);
  };
  var y = function(cb) {
    calls.push(2);
    setTimeout(function() {
      calls.push(3);
      cb();
    }, 0);
  };
  var inPath = join(FIXTURES_DIR, '*.txt');
  var config = {
    blog: {
      $inPath: inPath,
      $preProcess: [ x ]
    },
    news: {
      $inPath: inPath,
      $preProcess: [ y ]
    }
  };
  tomasi(config).build(function(err) {
    t.false(err);
    t.looseEquals(calls, [ 1, 2, 3, 4 ]);
    t.end();
  });
});

test('calls plugins in a single `$view` pipeline in series', function(t) {
  var calls = [];
  var x = function(cb, files, dataTypeName, viewName, dataTypes) {
    calls.push(1);
    t.equal(arguments.length, 5);
    var expectedFiles = [
      { $inPath: join(FIXTURES_DIR, '1-foo.txt'), $content: 'foo' },
      { $inPath: join(FIXTURES_DIR, '2-bar.txt'), $content: 'bar' },
      { $inPath: join(FIXTURES_DIR, '3-baz.txt'), $content: 'baz' }
    ];
    t.deepEqual(files, expectedFiles);
    t.equal(dataTypeName, 'blog');
    t.equal(viewName, 'single');
    t.deepEqual(dataTypes, {
      blog: {
        single: expectedFiles
      }
    });
    t.true(files === dataTypes.blog.single);
    cb(null, ['kanade']);
  };
  var y = function(cb, files, dataTypeName, viewName, dataTypes) {
    calls.push(2);
    t.deepEquals(files, ['kanade']);
    t.deepEquals(dataTypes.blog.single, ['kanade']);
    cb();
  };
  var config = {
    blog: {
      $inPath: join(FIXTURES_DIR, '*.txt'),
      $views: {
        single: [
          [ x, y ]
        ]
      }
    }
  };
  tomasi(config).build(function(err) {
    t.false(err);
    t.looseEquals(calls, [ 1, 2 ]);
    t.end();
  });
});

test('calls the build `cb` with the `err` if a plugin in a `$preProcess` pipeline has an error', function(t) {
  var calls = [];
  var x = function(cb) {
    calls.push(1);
    cb();
  };
  var y = function(cb) {
    calls.push(2);
    cb('error');
  };
  var z = function(cb) {
    calls.push(3);
    cb();
  };
  var inPath = join(FIXTURES_DIR, '*.txt');
  var config = {
    blog: {
      $inPath: inPath,
      $views: {
        single: [
          [ x, y, z ]
        ]
      }
    }
  };
  tomasi(config).build(function(err) {
    t.equal(err, 'error');
    t.looseEquals(calls, [ 1, 2 ]);
    t.end();
  });
});

test('runs consecutive `$view` pipelines in series', function(t) {
  var calls = [];
  var x = function(cb) {
    calls.push(1);
    cb(null, ['kanade']);
  };
  var y = function(cb, files, dataTypeName, viewName, dataTypes) {
    calls.push(2);
    t.equals(files, ['kanade']);
    t.equals(dataTypes.blog.single, ['kanade']);
    cb();
  };
  var inPath = join(FIXTURES_DIR, '*.txt');
  var config = {
    blog: {
      $inPath: inPath,
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
    t.looseEquals(calls, [ 1, 2 ]);
    t.end();
  });
});

test('runs parallel `$view` pipelines in parallel', function(t) {
  t.test('same data type', function() {
    var calls = [];
    var x = function(cb) {
      calls.push(1);
      setTimeout(function() {
        calls.push(3);
        cb();
      }, 10);
    };
    var y = function(cb) {
      calls.push(5);
      setTimeout(function() {
        calls.push(6);
        cb();
      }, 0);
    };
    var z = function(cb) {
      calls.push(2);
      setTimeout(function() {
        calls.push(4);
        cb();
      }, 20);
    };
    var inPath = join(FIXTURES_DIR, '*.txt');
    var config = {
      blog: {
        $inPath: inPath,
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
  t.test('different data types', function(t) {
    var calls = [];
    var x = function(cb) {
      calls.push(1);
      setTimeout(function() {
        calls.push(3);
        cb();
      }, 10);
    };
    var y = function(cb) {
      calls.push(5);
      setTimeout(function() {
        calls.push(6);
        cb();
      }, 0);
    };
    var z = function(cb) {
      calls.push(2);
      setTimeout(function() {
        calls.push(4);
        cb();
      }, 20);
    };
    var inPath = join(FIXTURES_DIR, '*.txt');
    var config = {
      blog: {
        $inPath: inPath,
        $views: {
          single: [
            [ x ],
            [ y ]
          ]
        }
      },
      news: {
        $inPath: inPath,
        $views: {
          single: [
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
});

test('uses settings in the specified `config` file', function(t) {
  var config = join(FIXTURES_DIR, 'tomasi.js');
  t.true(fs.existsSync(config));
  tomasi(config).build(function(err, dataTypes) {
    t.false(err);
    t.looseEquals(dataTypes.blog, [
      { $inPath: join(FIXTURES_DIR, '1-foo.txt'), $content: 'foo' },
      { $inPath: join(FIXTURES_DIR, '2-bar.txt'), $content: 'bar' },
      { $inPath: join(FIXTURES_DIR, '3-baz.txt'), $content: 'baz' }
    ]);
    t.end();
  });
});

test('throws if the specified `config` file does not exist', function(t) {
  t.throws(function() {
    var config = 'invalid';
    t.false(fs.existsSync(config));
    tomasi(config);
  });
  t.end();
});

test('can handle non-utf8 files', function(t) {
  var calls = [];
  var inPath = join(FIXTURES_DIR, 'heart.png');
  var content = fs.readFileSync(inPath);
  var expectedFiles = [
    { $inPath: inPath, $content: content }
  ];
  var x = function(cb, files, dataTypeName, viewName, dataTypes) {
    calls.push(1);
    t.equal(arguments.length, 5);
    t.deepEqual(files, expectedFiles);
    t.equal(dataTypeName, 'images');
    t.equal(viewName, null);
    t.deepEqual(dataTypes, {
      images: expectedFiles
    });
    t.equal(files, dataTypes.images);
    cb();
  };
  var y = function(cb, files, dataTypeName, viewName, dataTypes) {
    calls.push(2);
    t.equal(arguments.length, 5);
    t.deepEqual(files, expectedFiles);
    t.equal(dataTypeName, 'images');
    t.equal(viewName, 'single');
    t.deepEqual(dataTypes, {
      images: {
        single: expectedFiles
      }
    });
    t.equal(files, dataTypes.images.single);
    cb();
  };
  var config = {
    images: {
      $inPath: join(FIXTURES_DIR, '*.png'),
      $preProcess: [ x ],
      $views: {
        single: [
          [ y ]
        ]
      }
    }
  };
  tomasi(config).build(function(err) {
    t.false(err);
    t.looseEquals(calls, [ 1, 2 ]);
    t.end();
  });
});
