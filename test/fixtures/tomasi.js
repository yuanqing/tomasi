'use strict';

var join = require('path').join;
var $in = join(__dirname, '*.txt');

module.exports = function() {

  return {
    blog: {
      $in: $in,
      $out: {
        single: []
      }
    }
  };

};
