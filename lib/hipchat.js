var RSVP = require('rsvp');
var http = require('request');

module.exports = function(addon) {

  return {
    "sendMessage": function sendMessage(clientInfo, roomId, msg, opts){

      return new RSVP.Promise(function(resolve, reject){

        function makeRequest(clientInfo){
          addon.getAccessToken(clientInfo).then(function(token){
            var hipchatBaseUrl = clientInfo.capabilitiesDoc.links['api'];

            var msgUrl = hipchatBaseUrl + '/room/'+roomId+'/notification?auth_token=' + token.access_token;
            http.post({
              'url': msgUrl,
              'body': {
                'message': msg,
                'color': (opts && opts.options && opts.options.color) ? opts.options.color : 'yellow',
                'notify': (opts && opts.options && opts.options.notify) ? opts.options.notify : false
              },
              "json": true
            }, function(err, resp, body){
              if (err) {
                addon.logger.error('Error sending message to HipChat', err);
                reject(err);
                return;
              };
              resolve(body);
            });
          });
        }

        if (!clientInfo) {
          reject(new Error('clientInfo not available'));
          return;
        }
        if (typeof clientInfo === 'object'){
          makeRequest(clientInfo);
        } else {
          addon.loadClientInfo(clientInfo).then(makeRequest);
        }
      });
    }
  }
}
