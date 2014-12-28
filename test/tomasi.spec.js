/* globals describe, it, expect, jasmine */
'use strict';

var tomasi = require('..');
var fs = require('fs');
var bufferEqual = require('buffer-equal');

var inDir = './test/fixtures/';

var slice = function(args) {
  return [].slice.call(args);
};

describe('tomasi(config, cb)', function() {

  it('is a function', function() {
    expect(typeof tomasi).toBe('function');
  });

  it('throws if no `config`', function() {
    expect(function() {
      tomasi();
    }).toThrow();
  });

  it('throws if no `cb`', function() {
    expect(function() {
      tomasi({});
    }).toThrow();
  });

  it('calls `cb` with an `err` if no files match an `in` pattern', function(done) {
    var plugin = jasmine.createSpy().and.callFake(function(cb) {
      cb();
    });
    var config = {
      dataTypes: {
        'blog': {
          in: 'invalid/*.txt',
          out: {
            'single': [
              [ plugin ],
            ]
          }
        }
      }
    };
    expect(fs.existsSync('invalid')).toBe(false);
    tomasi(config, function(err) {
      expect(err.indexOf('no files match the pattern')).toBe(0);
      expect(plugin.calls.count()).toBe(0);
      done();
    });
  });

  it('can read utf8 files', function(done) {
    var plugin = jasmine.createSpy().and.callFake(function(cb) {
      var files = [
        { $content: 'foo' },
        { $content: 'bar' },
        { $content: 'baz' }
      ];
      var dataTypes = {
        'blog': {
          'single': files
        }
      };
      var args = slice(arguments);
      expect(args.length).toBe(6);
      expect(args[1]).toEqual(files);
      expect(args[2]).toBe('blog');
      expect(args[3]).toBe('single');
      expect(args[4]).toEqual(dataTypes);
      expect(args[5]).toEqual(config);
      expect(args[1]).toBe(args[4].blog.single);
      cb();
    });
    var config = {
      'blog': {
        in: inDir + '*.txt',
        out: {
          'single': [
            [ plugin ]
          ]
        }
      }
    };
    tomasi(config, function(err) {
      expect(err).toBeFalsy();
      expect(plugin.calls.count()).toBe(1);
      done();
    });
  });

  it('can read non-utf8 files', function(done) {
    var plugin = jasmine.createSpy().and.callFake(function(cb) {
      var args = slice(arguments);
      expect(args.length).toBe(6);
      expect(args[2]).toBe('images');
      expect(args[3]).toBe('single');
      expect(args[5]).toEqual(config);
      expect(args[1]).toBe(args[4].images.single);
      var img = fs.readFileSync(inDir + 'heart.png');
      expect(args[1].length).toBe(1);
      expect(bufferEqual(args[1][0].$content, img)).toBe(true);
      cb();
    });
    var config = {
      'images': {
        in: inDir + '*.png',
        out: {
          'single': [
            [ plugin ]
          ]
        }
      }
    };
    tomasi(config, function(err) {
      expect(err).toBeFalsy();
      expect(plugin.calls.count()).toBe(1);
      done();
    });
  });

  it('prefixes value of `config.inDir` to `in` of each data type', function(done) {
    var plugin = jasmine.createSpy().and.callFake(function(cb) {
      var files = [
        { $content: 'foo' },
        { $content: 'bar' },
        { $content: 'baz' }
      ];
      var dataTypes = {
        'blog': {
          'single': files
        }
      };
      var args = slice(arguments);
      expect(args.length).toBe(6);
      expect(args[1]).toEqual(files);
      expect(args[2]).toBe('blog');
      expect(args[3]).toBe('single');
      expect(args[4]).toEqual(dataTypes);
      expect(args[5]).toEqual(config);
      expect(args[1]).toBe(args[4].blog.single);
      cb();
    });
    var config = {
      inDir: inDir,
      dataTypes: { // data types must be defined under `config.dataTypes`
        'blog': {
          in: '*.txt',
          out: {
            'single': [
              [ plugin ]
            ]
          }
        }
      }
    };
    tomasi(config, function(err) {
      expect(err).toBeFalsy();
      expect(plugin.calls.count()).toBe(1);
      done();
    });
  });

  it('updates `files` and `dataTypes` if `cb` in a plugin is passed a second argument', function(done) {
    var filterPlugin = jasmine.createSpy().and.callFake(function(cb) {
      var files = [
        { $content: 'foo' },
        { $content: 'bar' },
        { $content: 'baz' }
      ];
      var dataTypes = {
        'blog': {
          'single': files
        }
      };
      var args = slice(arguments);
      expect(args.length).toBe(6);
      expect(args[1]).toEqual(files);
      expect(args[2]).toBe('blog');
      expect(args[3]).toBe('single');
      expect(args[4]).toEqual(dataTypes);
      expect(args[5]).toEqual(config);
      expect(args[1]).toBe(args[4].blog.single);
      cb(null, args[1].filter(function(file) {
        return file.$content === 'bar';
      })); // call `cb` with the filtered files
    });
    var plugin = jasmine.createSpy().and.callFake(function(cb) {
      var files = [
        { $content: 'bar' }
      ];
      var dataTypes = {
        'blog': {
          'single': files
        }
      };
      var args = slice(arguments);
      expect(args.length).toBe(6);
      expect(args[1]).toEqual(files);
      expect(args[2]).toBe('blog');
      expect(args[3]).toBe('single');
      expect(args[4]).toEqual(dataTypes);
      expect(args[5]).toEqual(config);
      expect(args[1]).toBe(args[4].blog.single);
      cb();
    });
    var config = {
      inDir: inDir,
      dataTypes: {
        'blog': {
          in: '*.txt',
          out: {
            'single': [
              [ filterPlugin, plugin ]
            ]
          }
        }
      }
    };
    tomasi(config, function(err) {
      expect(err).toBeFalsy();
      expect(filterPlugin.calls.count()).toBe(1);
      expect(plugin.calls.count()).toBe(1);
      done();
    });
  });

  it('calls plugins in a single pipeline in series', function(done) {
    var calls = [];
    var a = jasmine.createSpy().and.callFake(function(cb) {
      calls.push('a');
      cb();
    });
    var b = jasmine.createSpy().and.callFake(function(cb) {
      calls.push('b');
      cb();
    });
    var config = {
      inDir: inDir,
      dataTypes: {
        'blog': {
          in: '*.txt',
          out: {
            'single': [
              [ a, b ]
            ]
          }
        }
      }
    };
    tomasi(config, function(err) {
      expect(err).toBeFalsy();
      expect(a.calls.count()).toBe(1);
      expect(b.calls.count()).toBe(1);
      expect(calls).toEqual(['a', 'b']);
      done();
    });
  });

  it('calls pipelines at the same level in parallel', function(done) {
    var calls = [];
    var a = jasmine.createSpy().and.callFake(function(cb) {
      setTimeout(function() {
        calls.push('a');
        cb();
      }, 10);
    });
    var b = jasmine.createSpy().and.callFake(function(cb) {
      calls.push('b');
      cb();
    });
    var config = {
      inDir: inDir,
      dataTypes: {
        'blog': {
          in: '*.txt',
          out: {
            'single': [
              [ a ]
            ],
            'archive': [
              [ b ]
            ]
          }
        }
      }
    };
    tomasi(config, function(err) {
      expect(err).toBeFalsy();
      expect(a.calls.count()).toBe(1);
      expect(b.calls.count()).toBe(1);
      expect(calls).toEqual(['b', 'a']);
      done();
    });
  });

  it('calls adjoining pipelines in series', function(done) {
    var calls = [];
    var a = jasmine.createSpy().and.callFake(function(cb) {
      setTimeout(function() {
        calls.push('a');
        cb();
      }, 10);
    });
    var b = jasmine.createSpy().and.callFake(function(cb) {
      calls.push('b');
      cb();
    });
    var config = {
      inDir: inDir,
      dataTypes: {
        'blog': {
          in: '*.txt',
          out: {
            'single': [
              [ a ],
              [ b ]
            ]
          }
        }
      }
    };
    tomasi(config, function(err) {
      expect(err).toBeFalsy();
      expect(a.calls.count()).toBe(1);
      expect(b.calls.count()).toBe(1);
      expect(calls).toEqual(['a', 'b']);
      done();
    });
  });

});
