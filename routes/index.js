var RSVP = require('rsvp');
var http = require('request');
var render = require('../lib/messageRenderer')({
  templateDir: "./views/messages"
});

module.exports = function (app, addon) {
  var passport = addon.passport;
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

  app.post('/incoming', function(req, res){
    function send(msg){
      hipchat.sendMessage(req.query.i, req.query.r, msg).then(function(data){
        res.send(200);
      }).catch(function(err){
        addon.logger.error(err);
        res.send(500);
      });
    }

    function shouldMsgBeSent(id, evt){
      return new RSVP.Promise(function(resolve, reject){
        addon.settings.get('repos:'+id, req.query.i)
          .then(function(subscription){
            if (subscription.event.branchtag && (evt === 'create' || evt === 'delete')) {
              resolve(subscription);
            } else if (subscription.event[evt]){
              resolve(subscription);
            } else {
              reject(new Error('Not subscribed to event'));
            }
          })
          .catch(function(err){
            addon.logger.error(err);
            reject(err);
          });
      });

    }

    var event = req.headers['x-github-event'];
    var data = req.body;

    // special handling for push events
    if (event === 'push' && data.commits.length === 0) {
      res.send(200);
      return;
    }

    console.log(require('util').inspect(data, {colors:true, depth:4}));
    addon.logger.info('Received',event);

    shouldMsgBeSent(data.repository.id, event).then(function(){
      send(render(event, data));
    });
  });

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
