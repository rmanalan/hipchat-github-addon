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
          uri: uri,
          qs: {
            access_token: accessToken
          },
          rejectUnauthorized:false
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
          uri: uri,
          qs: {
            access_token: accessToken
          },
          body: data,
          rejectUnauthorized:false
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
          uri: uri,
          qs: {
            access_token: accessToken
          },
          rejectUnauthorized:false
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