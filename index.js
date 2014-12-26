'use strict';

var _ = require('savoy');
var clone = require('clone');
var fs = require('fs');
var glob = require('glob');
var isUtf8 = require('is-utf8');
var path = require('path');

var isObject = function(obj) {
  return obj !== null && typeof obj === 'object' && !Array.isArray(obj);
};

var tomasi = function(config, cb) {
  if (!isObject(config)) {
    throw 'missing config';
  }
  if (typeof cb !== 'function') {
    throw 'missing callback';
  }
  config.inDir = config.inDir || './in';
  _.waterfall({
    read: function(cb) {
      read(cb, config);
    },
    pipe: function(cb, dataTypes) {
      var cbWrap = function(err, i) {
        if (err || i === true) {
          return cb(err, dataTypes);
        }
        pipe(cbWrap, config, dataTypes, i);
      };
      cbWrap(null, 0);
    }
  }, cb);
};

var read = function(cb, config) {
  _.map(config.dataTypes, function(cb, dataTypeConfig) {
    var pattern = path.join(config.inDir, dataTypeConfig.in);
    _.waterfall({
      readFiles: function(cb) {
        readFiles(cb, pattern);
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
      $content: isUtf8(buffer) ? buffer.toString() : buffer
    });
  });
};

var pipe = function(cb, config, dataTypes, i) {
  var done = true;
  _.each(dataTypes, function(cb, dataType, dataTypeName) {
    _.each(dataType, function(cb, files, viewName) {
      var fns = config.dataTypes[dataTypeName].out[viewName][i];
      fns = [].concat(fns).filter(Boolean);
      if (!fns.length) {
        return cb();
      }
      done = false;
      _.each(fns, function(cb, fn) {
        fn(cb, files, dataTypeName, viewName, dataTypes, config);
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
