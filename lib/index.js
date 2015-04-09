'use strict';

/*eslint-env node */

/**
 * Test json ajax calls using a simple json file.
 *
 * This program takes a list of JSON api calls and checks you get back what you
 * expected. It can be run on all files in a directory on a single file or
 * simply pass in an object containing one or more tests. Internally it uses
 * [https://github.com/5app/json-assert](https://github.com/5app/json-assert) to
 * do the matching.
 *
 * It can handle posting files, waiting a set time for the back-end to finish
 * processing, and expecting set content-types or status codes.
 *
 * @module jsonApiTester
 */

var program = require('commander');
var request = require('request');
var fs = require('fs');
var _ = require('underscore');
var async = require('async');
var ja = require('json-assert');

/**
 * @typedef Settings
 *
 * The parsed output of `processCmdLineArgs` and the expected input of `test`
 *
 * @type {object}
 * @property {string} server - URL of a server e.g. `https://api.5app.com`.
 * @property {string} path - local path of file or folder to run.
 * @property {number} verbose - how much console.log statements.
 */

/**
 * @typedef TestObj
 *
 * @type {object}
 * @property {string} name - a name to identify it in the `console.log` output.
 * @property {number} wait - instead of running a test, wait the specified
 * number of miliseconds before continueing. Useful if you have some server side
 * function that takes a bit of time to run but it's a bit hacky.
 *
 * @property {string} method - one of ["GET", "PUT", "POST", "DELETE"].
 * @property {string} url - the url to call (that gets added to the serverName).
 * @property {Object?} args - what to pass as the body of the request. It should
 * be left out for GET requests.
 * @property {number?} status - check that the returned HTTP status code matches
 * this, we check using [jsonAssert](https://github.com/5app/json-assert)
 * meaning that ja.dontCare() or other functions can be used. If it is not
 * specified it defaults to 200.
 * @property {string?} contentType - check the returned `header["content-type"]`
 * matches this, again checked with `jsonAssert`, defaults to
 * "application/json".
 * @property {string?} timeout - fail the test if the request takes longer than
 * this many miliseconds. Defaults to 1000 (1sec).
 * @property {Object} returns - if the request returns a contentType of JSON
 * then parse it and check (with `jsonAssert`) that it matches the value
 * specified here.
 */

// ------------------------------------------------------------------------- //


/**
 * Deal with the command line arguments.
 *
 * To make it easy for us to create a command line program that runs our tests
 * this function takes command line args and parses them into an object that
 * `jsonApiTester.test` expects.
 *
 * @param {Object} args - this should be process.argv.
 * @returns {Settings} settings
 * @example var settings = jsonApiTester.processCmdLineArgs(process.argv);
 *
 */
exports.processCmdLineArgs = function(args) {

  function increaseVerbosity(v, total) {
    return total + 1;
  }

  program
  .version('0.0.1')
  .usage('[options] <server> <file/folder path>')
  .option('-v, --verbose', 'show debug messages', increaseVerbosity, 0)
  .parse(args);

  program.server = program.args[0];
  program.path = program.args[1];
  program.verbose = program.verbose || 0;

  if (!program.server) {
    throw new Error('expected a server name');
  }

  if (!program.path) {
    throw new Error('expected the path of the folder/file containing the tests');
  }

  if (program.verbose > 1) {
    console.log('-------------------');
    console.log('Running AJAX Tester');
    console.log(' path: %j', program.path);
    console.log(' server: %j', program.server);
    console.log(' verbosity: %j', program.verbose);
    console.log('-------------------');
  }

  return program;
};

// ------------------------------------------------------------------------- //
// ------------------------------------------------------------------------- //

/**
 * Run a single test as specified in an object.
 *
 * @param {TestObj} test - the test you want to run.
 * @param {Object?} cookieJar - optional `request.jar()` useful if you want to
 * save cookies between runs. The easier way is to call `testArray`.
 * @param {String} serverName - URL of a server e.g. `https://api.5app.com`.
 * @param {number} verbose - how much console.log statements.
 *
 * @example
 *
 * var testObj = {
 *  url: "/users/123",
 *  method: "POST",
 *  args: {name: "bob"},
 *  returns: null
 * }
 *
 * jsonApiTester.testArray(testObj, null, "https://test.com", 1, function(err) {
 *   assert.equal(err, null);
 * });
 *
 */
exports.singleTest = function(test, cookieJar, serverName, verbosity, callback) {

  if (verbosity > 1) {
    console.log('------ test data');
    console.log(JSON.stringify(test, null, 2));
    console.log('------');
  } else if (verbosity > 0) {
    console.log('Test:', test.name);
    if (test.wait) {
      console.log('  waiting', test.wait, 'ms');
    } else {
      console.log(' ', test.method, test.url);
    }
  }

  // just wait a while - some things need a little time to process
  if (test.wait) {
    setTimeout(callback, test.wait);
    return;
  }

  // add a protocal at the start if one is missing
  if (serverName.indexOf('http://') && serverName.indexOf('https://')) {
    serverName = 'http://' + serverName;
  }

  // read in the file if there is one
  var dataFile;
  if (test.form && test.form.file) {
    dataFile = fs.readFileSync(test.form.file);
  }

  // set the request
  var requestOpt = {
    url: serverName + '/' + test.url,
    method: test.method || 'GET',
    json: test.args,
    jar: cookieJar,
    timeout: test.timeout || 1000
  };

  var req = request(requestOpt, function(err, response, body) {
    var msg;

    if (verbosity > 1) {
      console.log('------ response');
      console.log(response);
      console.log('------ body');
      console.log(body);
      console.log('------');
    }

    // check there is no error
    if (err) {
      if (verbosity > 0) {
        console.log('Error, Failed test');
      }
      return callback(err);
    }

    // check the status code matches what is expected
    var expectedStatusCode = test.status || 200;
    if (!ja.isEqual(expectedStatusCode, response.statusCode)) {
      msg = 'Wrong status code: ' + response.statusCode;
      if (verbosity > 0) {
        console.log(msg);
      }
      return callback(msg);
    }

    // check the content type matches
    var expectedContentType = 'application/json';
    expectedContentType = test.contentType || expectedContentType;
    var type = response.headers['content-type'].split(';')[0];
    if (!ja.isEqual(expectedContentType, type)) {
      msg = 'Wrong mime type: ' + type;
      if (verbosity > 0) {
        console.log(msg);
      }
      return callback(msg);
    }

    // check the JSON matches
    if (type === 'application/json') {

      try {
        body = JSON.parse(body);
      } catch (e) {
        return callback(e);
      }

      if (!ja.isEqual(test.returns, body)) {
        msg = 'Wrong response body';
        if (verbosity > 0) {
          console.log(msg);
        }
        return callback(msg);
      }
    }

    // it must have all worked.
    return callback(null);
  });

  if (test.form) {
    var form = req.form();
    for (var f in test.form) {
      if (f === 'file') {
        form.append(
        f,
        dataFile, {
          knownLength: dataFile.length,
          filename: 'uploaded',
          contentType: 'application/octet-stream'
        }
        );
      } else {
        form.append(f, test.form[f]);
      }
    }
  }
};


// ------------------------------------------------------------------------- //
// ------------------------------------------------------------------------- //


/**
 * Run a test on each item in the array, keeping cookies between each test.
 *
 * @param {TestObj[]} test - the test you want to run.
 * @param {String} serverName - URL of a server e.g. `https://api.5app.com`.
 * @param {number} verbose - how much console.log statements.
 *
 * @example
 *
 * var testObjArr = [{
 *  url: "/users/123",
 *  method: "POST",
 *  args: {name: "bob"},
 *  returns: null
 * }];
 *
 * jsonApiTester.testArray(testObjArr "https://test.com", 1, function(err) {
 *   assert.equal(err, null);
 * });
 *
 */
exports.testArray = function(arr, serverName, verbosity, callback) {
  var cookieJar = request.jar();
  async.map(arr, function(test, done) {
    exports.singleTest(test, cookieJar, serverName, verbosity, done);
  }, callback);
};


/**
 * Run a test on each item in a javascript file that exportes a JSON array.
 *
 * We parse the javascript file instead of simply importing JSON so that we can
 * programatically create hundreds of tests if needed. An example file is
 * below:
 *
 * ```
 * module.exports = [{
 *  url: "/users/123",
 *  method: "POST",
 *  args: {name: "bob"},
 *  returns: null
 * }];
 * ```
 *
 * @param {String} path - local path of a json file containing tests to run.
 * @param {String} serverName - URL of a server e.g. `https://api.5app.com`.
 * @param {number} verbose - how much console.log statements.
 *
 * @example
 *
 * jsonApiTester.testFile('test.json', 'https://test.com', 1, function(err) {
 *   assert.equal(err, null);
 * });
 *
 */
exports.testFile = function(path, serverName, verbosity, callback) {
  var testArray = require(path);
  if (verbosity > 0) {
    console.log('Testing file: ', path);
  }
  exports.testArray(testArray, serverName, verbosity, callback);
};


/**
 * Run every tests on each javascript file in a directory.
 *
 * @param {String} path - local path of folder containing javascript files to
 * run as tests.
 * @param {String} serverName - URL of a server e.g. `https://api.5app.com`.
 * @param {number} verbose - how much console.log statements.
 *
 * @example
 *
 * jsonApiTester.testDirectory('tests/v2', 'https://test.com', 1, function(err) {
 *   assert.equal(err, null);
 * });
 */
exports.testDirectory = function(path, serverName, verbosity, callback) {
  fs.readdir(path, function(err, files) {
    if (err) {
      return callback(err);
    }

    // only deal with `js` files.
    files = _.filter(files, function(fileName) {
      return fileName.endsWith('.js');
    });

    async.series(files, function(file, done) {
      exports.testFile(path + '/' + file, serverName, verbosity, done);
    }, callback);

  });
};


/**
 * Run tests in given file or directory.
 *
 * @param {String} args - local path of folder or file with tests. This could
 * come from `processCmdLineArgs`.
 *
 * @example
 *
 * var args = {
 *   server: "https://test.com",
 *   verbose: 0,
 *   path: "tests/v2"
 * };
 *
 * jsonApiTester.test(args, function(err) {
 *   assert.equal(err, null);
 * });
 */
exports.test = function(args, callback) {
  fs.fstat(args.path, function(err, stats) {
    if (stats.isFile()) {
      exports.testFile(args.path, args.server, args.verbose, callback);
    } else if (stats.isDirectory()) {
      exports.testDirectory(args.path, args.server, args.verbose, callback);
    } else {
      callback(new Error('`path` is not a file or a directory'));
    }
  });
};

// -------------------------------------------------------------------------- //
