'use strict';

/*eslint-env node */

var program = require('commander');
var request = require('request');
var fs = require('fs');
var _ = require('underscore');
var async = require('async');
var ja = require('json-assert');

// ------------------------------------------------------------------------- //

// Deal with the command line arguments
// e.g. processCmdLineArgs(process.argv);
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

exports.singleTest = function(test, cookieJar, serverName, verbosity, callback) {

  if (verbosity > 1) {
    console.log('------ test data');
    console.log(JSON.stringify(test, null, 2));
    console.log('------');
  } else if (verbosity > 0) {
    console.log('Testing ', test.name);
    console.log(' ', test.method, test.url);
  }

  // just wait a while - some things need a little time to process
  if (test.wait) {
    setTimeout(callback, test.wait);
    return;
  }

  // read in the file if there is one
  var dataFile;
  if (test.form && test.form.file) {
    dataFile = fs.readFileSync(test.form.file);
  }

  // set the request
  var requestOpt = {
    url: 'https://' + serverName + test.url,
    method: test.method,
    json: test.args,
    jar: cookieJar
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
      if (!ja.isEqual(test.returns, body)) {
        msg = 'Wrong response body';
        if (verbosity > 0) {
          console.log(msg);
        }
        return callback(msg);
      }
    }
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


/*
 * run tests on each item in the array.
 */
exports.testArray = function runTests(arr, serverName, verbosity, callback) {
  var cookieJar = request.jar();
  async.series(arr, function(test, done) {
    exports.singleTest(test, cookieJar, serverName, verbosity, done);
  }, callback);
};


/*
 * run tests on the given file.
 */
exports.testFile = function(path, serverName, verbosity, callback) {
  var testArray = require(path);
  if (verbosity > 0) {
    console.log('Testing file: ', path);
  }
  exports.testArray(testArray, serverName, verbosity, callback);
};


/*
 * run tests on each file in a directory.
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


/*
 * the main function that does the testing.
 * args is the output of processCmdLineArgs
 * if args.path is a file then test the file otherwise test the directory
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
