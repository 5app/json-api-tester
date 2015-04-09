
# Documentation

For more detailed documentation run "npm run docs" and view the HTML files it
generates in ""./doc". This page is writen in
[literate](https://www.npmjs.com/package/literate) javascript meaning you can
run it to check that the documentation is correct. Take a look at
"test/docs.js", this also serves as the integration tests for the program.


## Quick overview


    // var jsonApiTester = require('json-api-tester');
    // jsonApiTester.processCmdLineArgs(process.argv)
    // jsonApiTester.singleTest(testObj, cookieJar, serverName, verbosity, callback)
    // jsonApiTester.testArray(testObjArr, serverName, verbosity, callback)
    // jsonApiTester.testFile(path, serverName, verbosity, callback)
    // jsonApiTester.testDirectory(path, serverName, verbosity, callback)
    // jsonApiTester.test(args)


## Examples

We start by including the library, and also json-assert for it's helpful utility
functions (you will see these later).

    var jsonApiTester = require('./'); // you will want 'json-api-tester' not '.'
    var ja = require('json-assert');

    var testObjArr = [];


### Basic Get

The name is just there to identify the test in console log outputs.

    testObjArr.push({
      name: "basic get",
      method: "GET",
      url: "hello/",
      returns: {
        message: "hello world"
      }
    });

    testObjArr.push({
      name: "do nothing for 5 seconds",
      wait: 5000
    });

## Run the tests

    exports.run = function(callback) {
      var serverName = "http://localhost:3000";
      var verbosity = 1; // you might want to turn down the noise
      jsonApiTester.testArray(testObjArr, serverName, verbosity, callback);
    }
