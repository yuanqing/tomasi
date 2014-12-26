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
    linkPrefix: '/',
    inDir: './in',
    outDir: './out',
    outFile: 'index.html',
    tmplDir: './tmpl',
    tmplEngine: 'ejs',
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

  _.map(config.dataTypes, function(cb, configDataType) {
    var pattern = pppath([config.inDir, configDataType.in]);
    readFiles(cb, pattern, configDataType.out);
  }, function(err, dataTypes) {
    cb(err, dataTypes);
  });

};

var readFiles = function(cb, pattern, viewsConfig) {

  _.waterfall({
    glob: function(cb) {
      glob(pattern, function(err, filenames) {
        cb(err, filenames);
      });
    },
    read: function(cb, filenames) {
      _.map(filenames, function(cb, filename) {
        readFile(cb, pattern, filename);
      }, function(err, files) {
        cb(err, files);
      });
    },
    clone: function(cb, files) {
      cb(null, _.map(viewsConfig, function(viewConfig) {
        return { config: viewConfig, files: clone(files) };
      }));
    }
  }, function(err, dataTypes) {
    cb(err, dataTypes);
  });

};

var readFile = function(cb, pattern, filename) {

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
  _.each(dataTypes, function(cb, views) {
    _.each(views, function(cb, view) {
      var pipes = [].concat(view.config[i]).filter(Boolean);
      if (!pipes.length) {
        return cb();
      }
      done = false;
      _.each(pipes, function(cb, pipe) {
        pipe(cb, view.files.filter(Boolean), dataTypes, config);
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
