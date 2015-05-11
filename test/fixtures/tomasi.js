'use strict';

var join = require('path').join;

var inPath = join(__dirname, '*.txt');

module.exports = function() {

  return {
    blog: {
      $inPath: inPath
    }
  };

};
