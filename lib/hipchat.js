var RSVP = require('rsvp');
var http = require('request');
var util = require('util');

module.exports = function(addon) {

  return {
    "sendMessage": function sendMessage(clientInfo, roomId, card, opts){

      return new RSVP.Promise(function(resolve, reject){

        function makeRequest(clientInfo){
          addon.getAccessToken(clientInfo).then(function(token){
            var hipchatBaseUrl = clientInfo.capabilitiesDoc.links['api'];

            var msgUrl = hipchatBaseUrl + '/room/'+roomId+'/notification?auth_token=' + token.access_token;
            var body = {
              message: card.original_html,
              color: (opts && opts.options && opts.options.color) ? opts.options.color : 'yellow',
              notify: (opts && opts.options && opts.options.notify) ? opts.options.notify : false,
              card: card
            };
            try {
              console.log(JSON.stringify(card,null,2));
            } catch(e) {
              console.log(e);
            }
            http.post({
              "url": msgUrl,
              "body": body,
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
