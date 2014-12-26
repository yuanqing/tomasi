/* globals describe, it, expect, jasmine */
'use strict';

var tomasi = require('..');
var fs = require('fs');
var bufferEqual = require('buffer-equal');

var inDir = './test/fixtures/';

describe('tomasi(config, cb)', function() {

  it('is a function', function() {
    expect(typeof tomasi).toBe('function');
  });

  it('throws if no `config`', function() {
    expect(function() {
      tomasi();
    }).toThrow('missing config');
  });

  it('throws if no `cb`', function() {
    expect(function() {
      tomasi({});
    }).toThrow('missing callback');
  });

  it('calls `cb` with an `err` if no files match the `in` pattern', function(done) {
    var plugin = jasmine.createSpy().and.callFake(function(cb) {
      cb();
    });
    var config = {
      'blog': {
        in: 'invalid/*.txt',
        out: {
          'single': [
            [ plugin ],
          ]
        }
      }
    };
    expect(fs.existsSync('./invalid/')).toBe(false);
    tomasi(config, function(err) {
      expect(err).toBe('no files match the pattern invalid/*.txt');
      done();
    });
  });

  it('handles utf8 files', function(done) {
    var plugin = jasmine.createSpy().and.callFake(function(cb) {
      cb();
    });
    var config = {
      inDir: inDir,
      dataTypes: {
        'blog': {
          in: '*.txt',
          out: {
            'single': [
              [ plugin ],
            ]
          }
        }
      }
    };
    tomasi(config, function(err) {
      var files = [
        { $content: 'foo' }
      ];
      var dataTypes = {
        'blog': {
          'single': files
        }
      };
      var args = plugin.calls.argsFor(0);
      expect(err).toBeFalsy();
      expect(plugin.calls.count(0)).toBe(1);
      expect(args[0]).toEqual(jasmine.any(Function));
      expect(args[1]).toBe(args[4].blog.single);
      expect(args[1]).toEqual(files);
      expect(args[2]).toEqual('blog');
      expect(args[3]).toEqual('single');
      expect(args[4]).toEqual(dataTypes);
      expect(args[5]).toEqual(config);
      done();
    });
  });

  it('handles non-utf8 files', function(done) {
    var plugin = jasmine.createSpy().and.callFake(function(cb) {
      cb();
    });
    var config = {
      inDir: inDir,
      dataTypes: {
        'images': {
          in: '*.png',
          out: {
            'single': [
              [ plugin ],
            ]
          }
        }
      }
    };
    tomasi(config, function(err) {
      var img = fs.readFileSync(inDir + 'heart.png');
      var args = plugin.calls.argsFor(0);
      expect(err).toBeFalsy();
      expect(plugin.calls.count(0)).toBe(1);
      expect(args[0]).toEqual(jasmine.any(Function));
      expect(args[1]).toBe(args[4].images.single);
      expect(args[1].length).toBe(1);
      expect(bufferEqual(args[1][0].$content, img)).toBe(true);
      expect(args[2]).toEqual('images');
      expect(args[3]).toEqual('single');
      expect(bufferEqual(args[4].images.single[0].$content, img)).toBe(true);
      expect(args[5]).toEqual(config);
      done();
    });
  });

});
