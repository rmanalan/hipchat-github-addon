var http = require('request');

module.exports = function (app, addon) {
  var passport = addon.passport;
  var proxies = require('./proxies')(app, addon);
  var config = require('./config')(app, addon);
  var hipchat = require('../lib/hipchat')(addon);

  app.get('/',

    function(req, res) {
      res.format({
        'text/html': function () {
          res.redirect(addon.descriptor.links.homepage);
        },
        'application/xml': function () {
          res.redirect('/atlassian-connect.json');
        }
      });
    }
  );

  app.post('/webhook',
    addon.authenticate(),
    function(req, res) {
      hipchat.sendMessage(req.clientInfo, req.context.item.room.id, 'pong').then(function(data){
        res.send(200);
      });
    }
  );

  // Notify the room that the add-on was installed
  addon.on('installed', function(clientKey, clientInfo, req){
    var hipchatUrl = clientInfo.capabilitiesDoc.links['api'];
    addon.getAccessToken(clientInfo).then(
      function(token) {
        http.post(hipchatUrl + '/room/'+req.body.roomId+'/notification?auth_token=' + token.access_token,{
          "body": {
            "message": "The GitHub add-on has been installed in this room"
          },
          "json": true
        }, function(err, res){
          if (err){
            addon.logger.error('Error sending message to HipChat', err);
          }
        });
      }, function(err) {
        addon.logger.error("Unable to get access token: ", err);
      }
    )

  });

  // Clean up clients when uninstalled
  addon.on('uninstalled', function(id){
    addon.settings.client.keys(id+':*', function(err, rep){
      rep.forEach(function(k){
        addon.logger.info('Removing key:', k);
        addon.settings.client.del(k);
      });
    });
  });

};
