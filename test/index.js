'use strict';

var tomasi = require('..');

var fs = require('fs');
var path = require('path');
var join = path.join;
var test = require('tape');

var RELATIVE_PATH = path.relative(process.cwd(), __dirname);
var FIXTURES_DIR = join(RELATIVE_PATH, 'fixtures');
var FIXTURES_ABS_DIR = join(__dirname, 'fixtures');

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
    t.equal(arguments.length, 6);
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
    cb(null, ['tomasi']);
  };
  var y = function(cb, files, dataTypeName, viewName, dataTypes) {
    calls.push(2);
    t.equal(arguments.length, 6);
    t.deepEqual(files, ['tomasi']);
    t.equal(dataTypeName, 'blog');
    t.equal(viewName, null);
    t.deepEqual(dataTypes.blog, ['tomasi']);
    t.true(files === dataTypes.blog);
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
    t.equal(arguments.length, 6);
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
    cb(null, ['tomasi']);
  };
  var y = function(cb, files, dataTypeName, viewName, dataTypes) {
    calls.push(2);
    t.equal(arguments.length, 6);
    var expectedFiles = ['tomasi'];
    t.deepEquals(files, expectedFiles);
    t.equal(dataTypeName, 'blog');
    t.equal(viewName, 'single');
    t.deepEqual(dataTypes, {
      blog: {
        single: expectedFiles
      }
    });
    t.true(files === dataTypes.blog.single);
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
    cb(null, ['tomasi']);
  };
  var y = function(cb, files, dataTypeName, viewName, dataTypes) {
    calls.push(2);
    t.deepEquals(files, ['tomasi']);
    t.deepEquals(dataTypes.blog.single, ['tomasi']);
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
  var config = join(FIXTURES_ABS_DIR, 'tomasi.js');
  t.true(fs.existsSync(config));
  tomasi(config).build(function(err, dataTypes) {
    t.false(err);
    t.looseEquals(dataTypes.blog, [
      { $inPath: join(FIXTURES_ABS_DIR, '1-foo.txt'), $content: 'foo' },
      { $inPath: join(FIXTURES_ABS_DIR, '2-bar.txt'), $content: 'bar' },
      { $inPath: join(FIXTURES_ABS_DIR, '3-baz.txt'), $content: 'baz' }
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

test('prepends `$dirs.$inDir` to each `$inPath`', function(t) {
  var config = {
    $dirs: {
      $inDir: FIXTURES_ABS_DIR
    },
    $dataTypes: {
      blog: {
        $inPath: '*.txt'
      }
    }
  };
  tomasi(config).build(function(err, dataTypes) {
    t.false(err);
    t.looseEquals(dataTypes.blog, [
      { $inPath: join(FIXTURES_ABS_DIR, '1-foo.txt'), $content: 'foo' },
      { $inPath: join(FIXTURES_ABS_DIR, '2-bar.txt'), $content: 'bar' },
      { $inPath: join(FIXTURES_ABS_DIR, '3-baz.txt'), $content: 'baz' }
    ]);
    t.end();
  });
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
    t.equal(arguments.length, 6);
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
    t.equal(arguments.length, 6);
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

test('watch', function(t) {

  t.test('errors on the initial build', function(t) {
    var x = function(cb) {
      cb('error');
    };
    var inPath = join(FIXTURES_DIR, '*.txt');
    var config = {
      blog: {
        $inPath: inPath,
        $preProcess: [ x ]
      }
    };
    tomasi(config).watch(function(err) {
      t.equal(arguments.length, 1);
      t.equal(err, 'error');
      t.end();
    });
  });

  t.test('errors on a build triggered by a file change', function(t) {
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

  t.test('no errors', function(t) {
    var inPath = join(FIXTURES_DIR, '*.txt');
    var config = {
      $dataTypes: {
        blog: {
          $inPath: inPath
        }
      }
    };
    var newFile = join(FIXTURES_DIR, 'watch.txt');
    tomasi(config).watch(function(err, dataTypes, event, path, watcher) {
      watcher.close();
      t.equal(arguments.length, 5);
      t.false(err);
      t.looseEquals(dataTypes.blog, [
        { $inPath: join(FIXTURES_DIR, '1-foo.txt'), $content: 'foo' },
        { $inPath: join(FIXTURES_DIR, '2-bar.txt'), $content: 'bar' },
        { $inPath: join(FIXTURES_DIR, '3-baz.txt'), $content: 'baz' },
        { $inPath: newFile, $content: 'qux' }
      ]);
      t.equal(event, 'added');
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

});
