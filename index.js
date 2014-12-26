'use strict';

var _ = require('savoy');
var clone = require('clone');
var defaults = require('defaults');
var extend = require('extend');
var fastmatter = require('fastmatter');
var fs = require('fs');
var glob = require('glob');
var isUtf8 = require('is-utf8');
var pppath = require('pppath');

var tomasi = function(config, cb) {

  config = defaults(config, {
    inDir: './in',
    dataTypes: {}
  });
  cb = cb || function(err) {
    if (err) {
      throw err;
    }
  };

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
    var pattern = pppath([config.inDir, dataTypeConfig.in]);
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
    if (err) {
      return cb(err);
    }
    var file = {};
    if (isUtf8(buffer)) {
      var fields = fastmatter(buffer.toString());
      extend(file, fields.attributes, { $content: fields.body });
    } else {
      file.$content = buffer;
    }
    cb(null, file);
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
