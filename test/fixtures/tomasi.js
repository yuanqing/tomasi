'use strict';

var filter = function(cb, files) {
  files.filter(function(file) {
    return file.$content === 'bar';
  });
  cb(null, files);
};

module.exports = {
  'blog': {
    in: '*.txt',
    out: {
      'single': [
        [ filter ]
      ]
    }
  }
};
