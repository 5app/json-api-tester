
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

Let's start by changing the default timeout. This is how long we will wait for a
test before giving up. It defaults to 2 seconds but we want to be a bit
stricter.

    jsonApiTester.defaultTimeout = 1000;

Here we check that calling GET http://localhost:3000/hello returns successfully
with some JSON that has a message of "hello world".

    testObjArr.push({
      name: "basic get",
      method: "GET",
      url: "/hello",
      returns: {
        message: "hello world"
      }
    });

A little hack to give the server some time to process things.

    testObjArr.push({
      name: "do nothing for half a second",
      wait: 500
    });

Test a POST to http://localhost:3000/not-found returns a status of 404, we don't
care what is in the body of the response.

    testObjArr.push({
      name: "not found",
      method: "POST",
      url: "/not-found",
      status: 404,
      contentType: ja.dontCare,
      returns: ja.dontCare
    });

If there was a url that you know takes a while to return you can give it a
different timeout, here we choose 5 seconds.

    testObjArr.push({
      name: "new timeout value",
      method: "GET",
      url: "/hello",
      timeout: 5000,
      returns: {
        message: "hello world"
      }
    });

We can use this up upload files too. Here we are uploading two files as well as
some text arguments.

    testObjArr.push({
      name: "post two files",
      method: "POST",
      url: "/files",
      timeout: 2000,
      args: {
        password: 'secret-key'
      },
      files: {
        key: 'README.md',
        cert: 'README.md'
      },
      returns: {
        message: "ok"
      }
    });

Finally we show off a few of the features of json-assert with a bigger request.

    testObjArr.push({
      name: "update a user",
      url: "/users/123",
      method: "PUT",
      args: {
        name: "bob",
        size: 15,
        hair: "red",
        height: 162
      },
      returns: {
        friends: ja.matchType('object'),
        size: 15,
        dob: ja.dontCare,
        pet: {
          type: "cat",
          age: ja.matchType('number'),
          collar: ja.optional
        }
      }
    })

## Run the tests

    exports.run = function(callback) {
      var serverName = "http://localhost:3000";
      var verbosity = 1; // you might want to turn down the noise
      jsonApiTester.testArray(testObjArr, serverName, verbosity, callback);
    }
