'use strict';
/*eslint-env node */

var express = require('express');
var app = express();
var docs = require('literate')('./DOCUMENTATION');

// respond with "hello world" when a GET request is made to the homepage
app.get('/hello', function(req, res) {
  res.json({
    message: 'hello world'
  });
});

// respond with "hello world" when a GET request is made to the homepage
app.get('/hello', function(req, res) {
  res.json({
    message: 'hello world'
  });
});

/*
  as this is the last normal route in the list it gets called if there are no
  other routes defined. Hence we can use this as the 404 handler.
*/
app.use(function(req, res) {
  res.status(404).json({
    msg: 'route not found'
  });
});

// start a server listening on port 3000
var server = app.listen(3000, function() {
  var host = server.address().address;
  var port = server.address().port;
  console.log('Listening at http://%s:%s', host, port);

  // finally require the thing that runs the tests and check our documentation is
  // correct.
  docs.run(function(err) {
    server.close();
    if (err) {
      console.log('!!! FAILED REGRESSION TESTS !!!');
      throw err;
    }
    console.log('All regression tests passed');
  });
});
