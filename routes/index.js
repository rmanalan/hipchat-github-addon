var RSVP = require('rsvp');
var http = require('request');
var render = require('../lib/messageRenderer')({
  templateDir: "./views/messages"
});

module.exports = function (app, addon) {
  var passport = addon.passport;
  var config = require('./config')(app, addon);
  var hipchat = require('../lib/hipchat')(addon);
  var github = require('../lib/github')(addon);

  app.get('/',

    function(req, res) {
      res.format({
        'text/html': function () {
          res.redirect(addon.descriptor.links.homepage);
        },
        'application/json': function () {
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
    // TODO verify x-hub-signature... currently broken. Can't seem to get matching hmac sigs
    // if (!req.isSecure) {
    //   // Return 200 even if the sig doesn't match, but ignore it locally.
    //   // See <http://pubsubhubbub.googlecode.com/svn/trunk/pubsubhubbub-core-0.3.html#authednotify>
    //   res.send(200)
    //   return;
    // }

    res.send(200);

    function send(msg, opts){
      hipchat.sendMessage(req.query.i, req.query.r, msg, opts).then(function(data){
      }).catch(function(err){
        addon.logger.error(err);
      });
    }

    // TODO support branch filtering
    function shouldMsgBeSent(id, evt, payload){
      return new RSVP.Promise(function(resolve, reject){
        addon.settings.get('repos:'+id, req.query.i)
          .then(function(subscription){
            if(!subscription) {
              reject(new Error('Subscription not found'));
              // TODO delete hook if hook is invalid
              return;
            }
            if (subscription.event.branchtag && (evt === 'create' || evt === 'delete')) {
              resolve(subscription);
            } else if (subscription.event.push && (evt === 'push')) {
              var branches = subscription.options.restrict_to_branch.split(',');
              for (i in branches) {
                var re = new RegExp(branches[i].replace(/^\s+|\s+$/g, ''));
                if (re.test(payload.ref)) {
                  resolve(subscription);
                  break;
                }
              }
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


    // limit # of commits to 5
    if (event === 'push' && data.commits){
      if (data.commits.length === 0) {
        return;
      }

      data.commitsLength = data.commits.length;
      data.commitsLengthMore = false;
      if (data.commits.length > 5) {
        data.commits = data.commits.slice(0,5);
        data.commitsLengthMore = true;
      }
    }

    // skip label events... annoys people
    if (data.action === 'labeled' || data.action === 'unlabeled') {
      return;
    }


    // console.log(require('util').inspect(data, {colors:true, depth:4}));
    // addon.logger.info('Received',event);
    // addon.logger.info('Data',data);

    if (data.zen) { return; } // GH ping event

    function deployStatusColorOverride(data, subscription){
      if ("deployment_status" in data) {
        switch (data.deployment_status.state) {
          case 'success':
            subscription.options.color = 'green';
            break;
          case 'pending':
            subscription.options.color = 'yellow';
            break;
          case 'error':
          case 'failure':
            subscription.options.color = 'red';
            break;
          default:
            subscription.options.color = 'yellow';
        }
      } else if ("deployment" in data) {
        subscription.options.color = 'yellow';
      }
      return subscription;
    }

    shouldMsgBeSent(data.repository.id, event, data)
      .then(function(subscription){
        send(render(event, data), deployStatusColorOverride(data, subscription));
      })
      .catch(function(err){
        addon.logger.error(404, err);
      });
  });

  // Notify the room that the add-on was installed
  addon.on('installed', function(clientKey, clientInfo, req){
    hipchat.sendMessage(clientInfo, req.body.roomId, 'The ' + addon.descriptor.name + ' add-on has been installed in this room');
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
