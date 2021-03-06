Mockingjays = require('../../mockingjays');
fs = require('fs');
http = require('http');
path = require('path');


module.exports = function () {
  var self = this;
  this.When(/^I make a "([^"]*)" request to "([^"]*)" with headers:$/, function (method, path, table, done) {
    var headers = {};

    table.rows().forEach(function(row) {
      headers[row[0]] = row[1];
    });

    var options = {
      hostname: 'localhost',
      port: this.options.port,
      path: path,
      method: method,
      headers: headers
    }

    var req = http.request(options, function(response) {
      var str = '';
      response.on('data', function (chunk) {str += chunk;});
      response.on('end', function() {
        self.result = str;
        done(str ? undefined : 'Empty Response');
      });
      response.on('error', function(){ done('Error during request.')});
    });
    req.on('error', function(){ done('Error during request.')});
    req.end();
  });


  this.Then(/^I see a cache file for "([^"]*)" with the following headers:$/, function (path, table, done) {
    var files = this.cacheFiles(this.options.cacheDir, path);
    if (files.length != 1) {
      done('Expecting 1 file for form-data. '+ files.length +' found');
    }

    var generatedJSON = JSON.parse(fs.readFileSync(files[0], {encoding: 'utf-8'}));
    var requiredHeadersFound = true;

    table.rows().forEach(function(row) {
      requiredHeadersFound = requiredHeadersFound
      && generatedJSON.request.headers[row[0]]
      && generatedJSON.request.headers[row[0]] == row[1]
    });


    done(!requiredHeadersFound ? 'Missing Headers': null);
  });
};
