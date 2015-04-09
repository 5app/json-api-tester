'use strict';
/*eslint-env node */

var express = require('express');
var busboy = require('connect-busboy');
var docs = require('literate')('./DOCUMENTATION');
var app = express();


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


app.put('/users/:id', function(req, res) {
  res.json({
    friends: ['mike', 'bill'],
    size: 15,
    dob: '12/1/1985',
    pet: {
      type: 'cat',
      age: 7
    }
  });
});


/*
 this must be given two files (called key and cert) and a password.
*/
app.post('/files', busboy({
  immediate: true
}), function(req, res, next) {
  if (req.busboy) {
    var files = {};
    var fields = {};

    req.busboy.on('file', function(fieldname, file, filename) {
      // console.log('file', fieldname);
      files[fieldname] = filename;
      file.on('data', function() {});
      file.on('end', function() {});
    });

    req.busboy.on('field', function(fieldname, value) {
      // console.log('field', fieldname, value);
      fields[fieldname] = value;
    });

    req.busboy.on('finish', function() {
      // console.log('finish', files, fields);
      if (!files.cert || !files.key || !fields.password) {
        return next(new Error('expected files'));
      }
      return res.json({
        message: 'ok'
      });
    });

  } else {
    return next(new Error('expected files'));
  }
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
