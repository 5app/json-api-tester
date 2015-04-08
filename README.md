JSON API Tester
===========

This program takes a list of JSON api calls and checks you get back what you expected. It can be run on all files in a directory on a single file or simply pass in an object containing one or more tests. Internally it uses [https://github.com/5app/json-assert](https://github.com/5app/json-assert) to do the matching.

It can handle posting files, waiting a set time for the back-end to finish processing, and expecting set content-types or status codes.


## Installation


    npm install json-api-tester --save


## Tests


    npm test
    npm run lint   # styleguide and code smells
    npm run fix    # try to autofix styleguide errors


## Usage


The magic all-in-one program:

    var jsonApiTester = require('json-api-tester');
    var args = jsonApiTester.processCmdLineArgs(process.argv);
    jsonApiTester.test(args);

A more telling example:

    var jsonApiTester = require('json-api-tester');
    var ja = require('json-assert');

    var serverName = "https://api.5app.com";
    var verbosity = 1;

    var testArray = [

      // check that doing a GET to `/hello` returns some JSON with a message
      // of "hello world" and a 200 status code.
      {
        url: "/hello",
        method: "GET",
        status: 200,
        returns: {
          message: "hello world"
        }
      },

      // wait 5 seconds for no real reason
      {
        wait: 5000
      },

      // do a post with JSON arguments
      // we don't care what we get back
      {
        url: "/users/123",
        method: "POST",
        args: {
            name: "bob",
            size: "15",
            hair: "none",
            height: "162"
        },
        status: ja.matchType('number'),
        returns: ja.dontCare()
      }
    ];

    jsonApiTester.testArray(arr, serverName, verbosity, function(err, result) {

    });


## Contributing

Make sure your code:

- that all new code has tests added
- that you match the styleguide `npm run lint`
- that all tests pass `npm test`

Then submit a pull request.
