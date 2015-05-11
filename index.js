'use strict';

var _ = require('savoy');
var cheque = require('cheque');
var clone = require('clone');
var fs = require('fs');
var glob = require('glob');
var isUtf8 = require('is-utf8');
var path = require('path');
var tomasiPlugins = require('tomasi-plugins');

var tomasi = function(config) {

  if (config == null) {
    config = 'tomasi.js';
  }
  if (!(this instanceof tomasi)) {
    return new tomasi(config);
  }
  if (cheque.isString(config)) {
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

  // PIPE

  var pipe = function(cb, fns, dataTypes, dataTypeName, viewName) {
    _.eachSeries(fns, function(cb, fn) {
      var files;
      if (viewName === null) {
        files = dataTypes[dataTypeName];
      } else {
        files = dataTypes[dataTypeName][viewName];
      }
      fn(function(err, files) {
        if (err) {
          return cb(err);
        }
        // `cb` can called without arguments
        if (!cheque.isUndefined(files)) {
          if (viewName === null) {
            dataTypes[dataTypeName] = files;
          } else {
            dataTypes[dataTypeName][viewName] = files;
          }
        }
        cb(err);
      }, files, dataTypeName, viewName, dataTypes);
    }, function(err) {
      cb(err);
    });
  };

  // READ

  var read = function(cb) {
    _.map(config, function(cb, dataTypeConfig) {
      _.waterfall({
        globFiles: function(cb) {
          globFiles(cb, dataTypeConfig.$in);
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

  var preProcess = function(cb, dataTypes) {
    _.each(config, function(cb, dataTypeConfig, dataTypeName) {
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

  var copy = function(cb, dataTypes) {
    _.map(config, function(cb, dataTypeConfig, dataTypeName) {
      if (dataTypeConfig.$views) {
        cb(null, _.map(dataTypeConfig.$views, function() {
          return clone(dataTypes[dataTypeName]);
        }));
      } else {
        cb(null, dataTypes[dataTypeName]);
      }
    }, function(err, dataTypes) {
      cb(err, dataTypes);
    });
  };

  // POST-PROCESS

  var postProcess = function(cb, dataTypes) {
    var cbWrap = function(err, i) {
      if (err || i === true) {
        return cb(err, dataTypes);
      }
      postProcessPipe(cbWrap, dataTypes, i);
    };
    cbWrap(null, 0);
  };

  var postProcessPipe = function(cb, dataTypes, i) {
    var done = true;
    _.each(dataTypes, function(cb, dataType, dataTypeName) {
      _.each(dataType, function(cb, files, viewName) {
        if (config[dataTypeName].$views == null) {
          return cb();
        }
        var fns = config[dataTypeName].$views[viewName][i];
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

  return {
    build: function(cb) {
      _.waterfall([
        read,
        preProcess,
        copy,
        postProcess
      ], cb);
    }
  };

};

module.exports = tomasi;
