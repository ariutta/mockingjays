/**
 * Core that determines wether to fetch a fresh copy from the source or
 * fetch a cached copy of the data.
 */

var CacheClient = require('./cache_client');
var HttpClient = require('./http_client');

var Mockingjay = function(options) {
  this.options = options;
  this.cacheClient = new CacheClient(this.options.cacheDir);
  this.httpClient = new HttpClient();
}

/**
 * Determine if we have request cached.
 */
Mockingjay.prototype.knows = function(request) {
  return this.cacheClient.isCached(request);
};

/**
 * Fetch a Request form cache.
 */
Mockingjay.prototype.repeat = function(request) {
  console.log("\tMockingjay Repeating: " + JSON.stringify(request));
  return this.cacheClient.fetch(request);
};

/**
 * Fetch a Request form the Source.
 */
Mockingjay.prototype.learn = function(request) {
  console.log("\tMockingjay Learning: " + JSON.stringify(request));
  var self = this;
  var responsePromise = this.httpClient.fetch(request);
  return responsePromise.then(function(response) {
    return self.cacheClient.record(request, response);
  });
};

/**
 * Function that echos the response back to the client.
 * Within this function we determine if we need to learn
 * or need to fetch a fresh response.
 */
Mockingjay.prototype.echo = function(request, outputBuffer) {
  var responsePromise = this.knows(request) ? this.repeat(request) : this.learn(request);
  responsePromise.then(function(response) {
    var responseString = typeof(response.data) === 'string' ? response.data : JSON.stringify(response.data);
    console.log("\n\tResponding: ", response.status, response.type);
    console.log("\t"+ responseString);
    outputBuffer.writeHead(response.status, response.type);
    outputBuffer.end(responseString);
  });
};

/**
 * Callback that is called when the server recieves a request.
 */
Mockingjay.prototype.onRequest = function(request, response) {
  var self = this;
  var simplifiedRequest = this.simplify(request);

  console.log("\n\t\[\033[1;34m\]New Request:\[\033[0m\]", request.url, request.method);
  // Set CORS headers
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,Content-Type,Accept,Origin,Authorization');
  response.setHeader('Access-Control-Allow-Methods', 'HEAD,OPTIONS,GET,PUT,POST,DELETE');
  response.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  response.setHeader('Access-Control-Max-Age', '1800');

  request.on('data', function(data) {
    simplifiedRequest.body += data;
  });

  request.on('end', function() {
    self.echo(simplifiedRequest, response);
  });
};


Mockingjay.prototype.simplify = function (req) {
  var headers = this.reduceHeaders(req.headers);
  return {
    url: this.options.serverBaseUrl + req.url,
    body: '',
    headers: headers,
    method: req.method
  };
};

Mockingjay.prototype.HeaderWhiteList = ['authorization', 'content-length', 'content-type'];

Mockingjay.prototype.reduceHeaders = function (requestHeaders) {
  var headers = this.sortHeaders(requestHeaders);
  var whitelist = this.HeaderWhiteList;
  var self = this;

  var isAllowed = function(key) {
    var isInWhiteList = whitelist.indexOf(key) !== -1;
    if (isInWhiteList)
      return !(key === 'content-length' && headers[key] === "0"); // Only include content length of non-zero length.
    return false;
  };

  var allowedHeaders = {};
  for (var key in headers) {
    if (isAllowed(key)) {
      allowedHeaders[key] = headers[key];
    }
  }
  // Remove Headers which Might Vary from agent to agent.
  // Variability in headers leads to a different hash for a requst.
  return allowedHeaders;
}


Mockingjay.prototype.sortHeaders = function (requestHeaders) {
  // Sort the keys to get predictable order in object keys.
  var keys = [];
  for (var key in requestHeaders) {
    keys.push(key);
  }
  keys.sort();

  // Copy the Keys in order:
  var headers = {};
  keys.forEach(function(key) {
    // Standardize the key to be lowercase:
    headers[key.toLowerCase()] = requestHeaders[key];
  });

  return headers;
}

module.exports = Mockingjay
