'use strict';

var path = require('path');

var pattern = path.join(__dirname, '*.txt');

module.exports = function() {

  return {
    blog: {
      $in: pattern,
      $views: {
        single: []
      }
    }
  };

};
