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
var path = require('path');
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
 * this many miliseconds. Defaults to `jsonApiTester.defaultTimeout` (2sec).
 * @property {Object} returns - if the request returns a contentType of JSON
 * then parse it and check (with `jsonAssert`) that it matches the value
 * specified here.
 * @property {Object?} files - this uses the form uploader rather than json, the
 * args are still used but passed as form elements. This is an object with the
 * name to use for the form as the keys and the file path as the values.
 */

// ------------------------------------------------------------------------- //

function endsWith(str, suffix) {
  return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

// ------------------------------------------------------------------------- //


/**
 * {number} defaultTimeout - fail the test if the request takes longer than this
 * many miliseconds. Defaults to 2000 (2sec).
 */
exports.defaultTimeout = 2000;


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
    .version('0.1.0')
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
  callback = callback || function() {};

  if (verbosity > 1) {
    console.log('============================================================');
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

  // set the request
  var requestOpt = {
    url: serverName + test.url,
    method: test.method || 'GET',
    jar: cookieJar,
    timeout: test.timeout || exports.defaultTimeout
  };

  // if we are uploading a file we use the form upload (see below). This means
  // we do not use the args as json.
  if (!test.files) {
    requestOpt.json = test.args;
  }

  if (verbosity > 1) {
    console.log('->', requestOpt.method, requestOpt.url);
  }

  var req = request(requestOpt, function(err, response, body) {
    var msg;

    if (verbosity > 1) {
      console.log('------ response');
      if (response) {
        console.log('code', response.statusCode);
        console.log('content-type', response.headers['content-type']);
      } else {
        console.log('nully', typeof response, response);
      }
      console.log('------ body');
      console.log(body);
      console.log('------');
    }

    // check there is no error
    if (err) {
      if (verbosity > 0) {
        console.log('Error, Failed test', err);
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

    // sometimes no content-type header is given. Deal with it.
    var type = response.headers['content-type'];
    if (type) {
      type = type.split(';')[0];
    }

    if (!ja.isEqual(expectedContentType, type)) {
      msg = 'Wrong content type: ' + type;
      if (verbosity > 0) {
        console.log(msg);
      }
      return callback(msg);
    }

    // check the JSON matches
    if (type === 'application/json') {

      // I'm not sure why request sometimes parses and sometimes doesn't
      if (typeof body !== 'object') {
        try {
          body = JSON.parse(body);
        } catch ( e ) {
          if (verbosity > 0) {
            console.log('error parsing json', e);
          }
          return callback(e);
        }
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

  // if we have some files to upload don't use the args use the form uploader
  // we expect the files to be an object with the name to use for the form as
  // the key and the file path as the value.
  if (test.files) {
    var form = req.form();

    // add the files thmeselves
    _.each(test.files, function(filePath, fieldname) {
      /*
        this is probably better done with fs.createReadStream but I can't get
        it working. I also don't how to properly deal with errors (such as a
        missing file) in a stream that I'm giving to someone else.

        Also I'm using a fs Sync function, I couldn't get the other one working.
      */
      var fileStr = fs.readFileSync(filePath);
      form.append(fieldname, fileStr, {
        knownLength: fileStr.length,
        filename: path.basename(filePath),
        contentType: 'application/octet-stream'
      });
    });

    // add all the non file parts.
    _.each(test.args, function(value, fieldname) {
      form.append(fieldname, value);
    });
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
  callback = callback || function() {};
  var cookieJar = request.jar();
  async.mapSeries(arr, function(test, done) {
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
 * @param {String} filePath - local path of a json file containing tests to run.
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
exports.testFile = function(filePath, serverName, verbosity, callback) {
  callback = callback || function() {};
  fs.realpath(filePath, function(err, fullPath) {
    if (err) {
      return callback(err);
    }
    var testArray = require(fullPath);
    if (verbosity > 0) {
      console.log('Testing file: ', filePath);
    }
    exports.testArray(testArray, serverName, verbosity, callback);
  });
};


/**
 * Run every tests on each javascript file in a directory.
 *
 * @param {String} dirPath - local path of folder containing javascript files to
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
exports.testDirectory = function(dirPath, serverName, verbosity, callback) {
  callback = callback || function() {};
  fs.readdir(dirPath, function(err, files) {
    if (err) {
      return callback(err);
    }

    // only deal with `js` files.
    files = _.filter(files, function(fileName) {
      return endsWith(fileName, '.js');
    });

    async.mapSeries(files, function(file, done) {
      exports.testFile(path.join(dirPath, file), serverName, verbosity, done);
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
  callback = callback || function() {};
  fs.stat(args.path, function(err, stats) {
    if (err) {
      callback(new Error('error reading `path`'));
    }
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
