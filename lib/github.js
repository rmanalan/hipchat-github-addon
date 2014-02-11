var RSVP = require('rsvp');
var http = require('request').defaults({
  json: true,
  headers: {
    'User-Agent': 'HipChat/GitHub Connector'
  }
});

module.exports = function(addon) {
  return {
    get: function(uri, accessToken){
      return new RSVP.Promise(function(resolve, reject){
        http.get({
          uri: addon.API_BASE_URI + uri,
          qs: {
            access_token: accessToken
          },
        }, function(err, resp, body){
          if(err){
            reject(err);
            return;
          }
          resolve(resp);
        });
      });
    },

    post: function(uri, accessToken, data){
      return new RSVP.Promise(function(resolve, reject){
        http.post({
          uri: addon.API_BASE_URI + uri,
          qs: {
            access_token: accessToken
          },
          body: data
        }, function(err, resp, body){
          if(err){
            reject(err);
            return;
          }
          resolve(resp);
        });
      });
    },

    delete: function(uri, accessToken){
      return new RSVP.Promise(function(resolve, reject){
        http.del({
          uri: addon.API_BASE_URI + uri,
          qs: {
            access_token: accessToken
          }
        }, function(err, resp, body){
          if(err){
            reject(err);
            return;
          }
          resolve(resp);
        });
      });
    }

  }
}