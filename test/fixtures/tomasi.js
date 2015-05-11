'use strict';

var join = require('path').join;

var pattern = join(__dirname, '*.txt');

module.exports = function() {

  return {
    blog: {
      $inPath: pattern
    }
  };

};
