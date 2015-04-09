'use strict';

/*eslint-env node, mocha */

var assert = require('chai').assert;
var jsonApiTester = require('../..');


describe('json-api-tester', function() {
  describe('processCmdLineArgs', function() {

    it('should error with no args', function() {
      assert.throw(function() {
        jsonApiTester.processCmdLineArgs(['node', 'index.js']);
      }, Error, 'expected a server name');
    });

    it('should error with only one arg', function() {
      assert.throw(function() {
        jsonApiTester.processCmdLineArgs(['node', 'index.js', 'beta.5app.com']);
      }, Error, 'expected the path of the folder/file containing the tests');
    });

    it('should work with no verbosity', function() {
      var args = jsonApiTester.processCmdLineArgs(['node', 'index.js', 'beta.5app.com', 'test']);
      assert.equal(args.server, 'beta.5app.com');
      assert.equal(args.verbose, 0);
      assert.equal(args.path, 'test');
    });

    it('should work with one verbosity', function() {
      var args = jsonApiTester.processCmdLineArgs(['node', 'index.js', 'beta.5app.com', 'test', '-v']);
      assert.equal(args.server, 'beta.5app.com');
      // the tests break if we check an explicit value as commander was not meant to be used to test like this
      assert(args.verbose);
      assert.equal(args.path, 'test');
    });

    it('should work with multiple verbosity', function() {
      var args = jsonApiTester.processCmdLineArgs(['node', 'index.js', 'beta.5app.com', 'test', '-vvv']);
      assert.equal(args.server, 'beta.5app.com');
      assert(args.verbose);
      assert.equal(args.path, 'test');
    });

  });

  // ------------------------------------------------------------------------ //

});
