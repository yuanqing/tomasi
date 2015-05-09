'use strict';

var _ = require('savoy');
var cheque = require('cheque');
var clone = require('clone');
var fs = require('fs');
var glob = require('glob');
var isUtf8 = require('is-utf8');
var plugins = require('tomasi-plugins');
var resolve = require('path').resolve;

var tomasi = function(config, cb) {
  if (cheque.isFunction(config)) {
    cb = config;
    config = 'tomasi.js';
  }
  if (cheque.isString(config)) {
    var cwd = process.cwd();
    var configFile = resolve(cwd, config);
    if (!fs.existsSync(configFile)) {
      throw new Error('could not find the file ' + config + ' in ' + cwd);
    }
    config = require(configFile)(plugins);
  }
  if (!cheque.isObject(config)) {
    throw new Error('missing config');
  }
  if (!cheque.isFunction(cb)) {
    throw new Error('missing callback');
  }
  _.waterfall({
    normalise: function(cb) {
      normalise(cb, config);
    },
    read: function(cb, config) {
      read(cb, config);
    },
    pipe: function(cb, dataTypes) {
      var cbWrap = function(err, i) {
        if (err || i === true) {
          return cb(err, dataTypes);
        }
        pipe(cbWrap, dataTypes, config, i);
      };
      cbWrap(null, 0);
    }
  }, cb);
};

tomasi.plugins = plugins;

var normalise = function(cb, config) {
  cb(null, _.map(config, function(dataTypeConfig) {
    if (!cheque.isObject(dataTypeConfig.out)) {
      dataTypeConfig.out = {
        $: dataTypeConfig.out
      };
    }
    return dataTypeConfig;
  }));
};

var read = function(cb, config) {
  _.map(config, function(cb, dataTypeConfig) {
    _.waterfall({
      readFiles: function(cb) {
        readFiles(cb, dataTypeConfig.in);
      },
      clone: function(cb, files) {
        cb(null, _.map(dataTypeConfig.out, function() {
          return clone(files);
        }));
      }
    }, cb);
  }, function(err, dataTypes) {
    cb(err, dataTypes);
  });
};

var readFiles = function(cb, pattern) {
  _.waterfall({
    glob: function(cb) {
      glob(pattern, function(err, filenames) {
        cb(err, filenames);
      });
    },
    readFile: function(cb, filenames) {
      if (filenames.length === 0) {
        return cb('no files match the pattern ' + pattern);
      }
      _.map(filenames, function(cb, filename) {
        readFile(cb, filename);
      }, function(err, files) {
        cb(err, files);
      });
    }
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

var pipe = function(cb, dataTypes, config, i) {
  var done = true;
  _.each(dataTypes, function(cb, dataType, dataTypeName) {
    _.each(dataType, function(cb, files, viewName) {
      var fns = config[dataTypeName].out[viewName][i];
      fns = [].concat(fns).filter(Boolean);
      if (!fns.length) {
        return cb();
      }
      done = false;
      _.eachSeries(fns, function(cb, fn) {
        fn(function(err, result) {
          if (typeof result !== 'undefined') {
            dataType[viewName] = result;
          }
          cb(err);
        }, dataType[viewName], dataTypeName, viewName, dataTypes);
      }, function(err) {
        cb(err);
      });
    }, function(err) {
      cb(err);
    });
  }, function(err) {
    cb(err, done || i + 1);
  });
};

module.exports = tomasi;
