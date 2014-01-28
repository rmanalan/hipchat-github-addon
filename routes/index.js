var http = require('request');
var auth = require('./auth');

module.exports = function (app, addon) {
  var passport = addon.passport;
  var github = auth(app, addon, passport);

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

  app.get('/config',
    addon.authenticate(),
    github.ensureAuthenticated(),
    function(req, res) {
      res.render('config', req.context);
    }

  );

  app.post('/webhook',
    addon.authenticate(),
    function(req, res) {
      addon.getAccessToken(req.clientInfo).then(function(token){
        var hipchatBaseUrl = req.clientInfo.capabilitiesDoc.links['api'];
        var msgUrl = hipchatBaseUrl + '/room/'+req.context.item.room.id+'/notification?auth_token=' + token.access_token;
        console.log(msgUrl);
        http.post({
          'url': msgUrl,
          'body': {
            'message': 'pong'
          },
          "json": true
        }, function(err, resp, body){
          console.log('msg sent')
          res.send(200);
        });
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
