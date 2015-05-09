'use strict';

var path = require('path');
var inPath = path.join(__dirname, '*.txt');

module.exports = function() {

  return {
    blog: {
      in: inPath,
      out: {
        single: []
      }
    }
  };

};
