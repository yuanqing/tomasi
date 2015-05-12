'use strict';

var _ = require('savoy');
var cheque = require('cheque');
var clone = require('clone');
var defaults = require('defaults');
var ecstatic = require('ecstatic');
var fs = require('fs');
var gaze = require('gaze');
var glob = require('glob');
var http = require('http');
var isRelative = require('is-relative');
var isUtf8 = require('is-utf8');
var noop = function() {};
var path = require('path');
var tomasiPlugins = require('tomasi-plugins');

var tomasi = function(config) {

  if (config == null) {
    throw new Error('missing config');
  }

  if (cheque.isString(config)) {
    // Resolve the path to the `config` file, and `require` it.
    var cwd = process.cwd();
    var configFile = path.resolve(cwd, config);
    if (!fs.existsSync(configFile)) {
      throw new Error('could not find the file ' + config + ' in ' + cwd);
    }
    config = require(configFile);
  }

  if (cheque.isFunction(config)) {
    config = config.bind(tomasiPlugins)();
  }

  if (!cheque.isObject(config)) {
    throw new Error('config must be an object');
  }

  if (config.$dataTypes == null) {
    config = {
      $dataTypes: config
    };
  }
  config.$dirs = config.$dirs || {
    $inDir: '.',
    $outDir: 'out',
    $tmplDir: '.'
  };

  // Pipe files through each plugin in `plugins`. This is called by the
  // `preProcess` and `postProcessIteration` functions.
  var pipe = function(cb, plugins, dataTypes, dataTypeName, viewName) {
    _.eachSeries(plugins, function(cb, plugin) {
      var files;
      // `viewName` will be `null` if we are in a `$preProcess` pipeline.
      if (viewName === null) {
        files = dataTypes[dataTypeName];
      } else {
        files = dataTypes[dataTypeName][viewName];
      }
      plugin(function(err, files) {
        if (err) {
          return cb(err);
        }
        // The plugin's `cb` may be called without the `files` argument. Only
        // update `dataTypes` if `files` is set.
        if (!cheque.isUndefined(files)) {
          if (viewName === null) {
            dataTypes[dataTypeName] = files;
          } else {
            dataTypes[dataTypeName][viewName] = files;
          }
        }
        cb(err);
      }, files, dataTypeName, viewName, dataTypes, config);
    }, function(err) {
      cb(err);
    });
  };

  // READ
  //
  // For each data type, glob files based on its `$inPath`, and read the
  // contents of the matched files. Each array of files is keyed on the name
  // of the data type. `cb` is called with the resulting `dataTypes` object.

  var read = function(cb) {
    _.map(config.$dataTypes, function(cb, dataTypeConfig) {
      _.waterfall({
        globFiles: function(cb) {
          // Prepend `config.$dirs.$inDir` to `pattern` if and only if
          // `pattern` is a relative path.
          var pattern = dataTypeConfig.$inPath;
          if (isRelative(pattern)) {
            pattern = path.join(config.$dirs.$inDir, pattern);
          }
          globFiles(cb, pattern);
        },
        readFiles: function(cb, filenames) {
          readFiles(cb, filenames);
        }
      }, function(err, files) {
        cb(err, files);
      });
    }, function(err, dataTypes) {
      cb(err, dataTypes);
    });
  };

  var globFiles = function(cb, pattern) {
    glob(pattern, function(err, filenames) {
      if (filenames.length === 0) {
        return cb('no files match the pattern ' + pattern);
      }
      cb(err, filenames);
    });
  };

  var readFiles = function(cb, filenames) {
    _.map(filenames, function(cb, filename) {
      readFile(cb, filename);
    }, function(err, files) {
      cb(err, files);
    });
  };

  var readFile = function(cb, filename) {
    fs.readFile(filename, function(err, buffer) {
      cb(err, {
        $inPath: filename,
        $content: isUtf8(buffer) ? buffer.toString() : buffer
      });
    });
  };

  // PRE-PROCESS
  //
  // For each data type, pipe its files through its `$preProcess` pipeline.
  // `cb` is called with the resulting `dataTypes` object. The structure of
  // `dataTypes` is unchanged.

  var preProcess = function(cb, dataTypes) {
    _.each(config.$dataTypes, function(cb, dataTypeConfig, dataTypeName) {
      var fns = dataTypeConfig.$preProcess;
      fns = [].concat(fns).filter(Boolean);
      if (fns.length === 0) {
        return cb();
      }
      pipe(cb, fns, dataTypes, dataTypeName, null);
    }, function(err) {
      cb(err, dataTypes);
    });
  };

  // COPY
  //
  // For each data type, make a copy of its files for each of its views. Each
  // copy is keyed on the name of the view. If a data type has no views, its
  // files are not copied, and remain keyed on the name of the data type.
  // `cb` is called with the resulting `dataTypes` object.

  var copy = function(cb, dataTypes) {
    _.map(config.$dataTypes, function(cb, dataTypeConfig, dataTypeName) {
      if (dataTypeConfig.$views) {
        cb(null, _.map(dataTypeConfig.$views, function() {
          return clone(dataTypes[dataTypeName]);
        }));
      } else {
        // Exit if the data type has no views.
        cb(null, dataTypes[dataTypeName]);
      }
    }, function(err, dataTypes) {
      cb(err, dataTypes);
    });
  };

  // POST-PROCESS
  //
  // For each data type, pipe the files for each of its views through its
  // `$views` pipeline(s).

  var postProcess = function(cb, dataTypes) {
    var cbWrap = function(err, i) {
      if (err || i === true) {
        return cb(err, dataTypes);
      }
      postProcessIteration(cbWrap, dataTypes, i);
    };
    cbWrap(null, 0);
  };

  var postProcessIteration = function(cb, dataTypes, i) {
    var done = true;
    _.each(dataTypes, function(cb, dataType, dataTypeName) {
      _.each(dataType, function(cb, files, viewName) {
        var dataTypeConfig = config.$dataTypes;
        // Exit if no `$views`.
        if (dataTypeConfig[dataTypeName].$views == null) {
          return cb();
        }
        var fns = dataTypeConfig[dataTypeName].$views[viewName][i];
        fns = [].concat(fns).filter(Boolean);
        if (fns.length === 0) {
          return cb();
        }
        done = false;
        pipe(cb, fns, dataTypes, dataTypeName, viewName);
      }, function(err) {
        cb(err);
      });
    }, function(err) {
      cb(err, done || i + 1);
    });
  };

  var inPaths = _.fold(config.$dataTypes, [], function(acc, dataTypes) {
    var inPath = dataTypes.$inPath;
    if (isRelative(inPath)) {
      inPath = path.join(config.$dirs.$inDir, inPath);
    }
    acc.push(inPath);
    return acc;
  });

  var build = function(cb) {
    _.waterfall([
      read,
      preProcess,
      copy,
      postProcess
    ], cb);
  };

  var watch = function(cb, opts) {
    opts = defaults(opts, {
      onStart: noop,
      onChange: noop
    });
    gaze(inPaths, function(err, watcher) {
      opts.onStart();
      watcher.on('all', function(event, path) {
        opts.onChange(event, path);
        build(function(err, dataTypes) {
          if (err) {
            watcher.close();
            return cb(err);
          }
          cb(err, dataTypes, watcher);
          opts.onStart();
        });
      });
    });
  };

  var serve = function(cb, opts) {
    opts = defaults(opts, {
      onStart: noop,
      port: 8080
    });
    opts.root = config.$dirs.$outDir;
    var server = http.createServer(ecstatic(opts)).listen(opts.port);
    opts.onStart(opts.port);
    server.on('error', cb);
  };

  return {
    build: build,
    watch: watch,
    serve: serve
  };

};

module.exports = tomasi;
