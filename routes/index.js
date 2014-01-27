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

      // TODO convert this to middleware
      addon.loadClientInfo(req.body.oauth_client_id).then(
        function(clientInfo) {
          if (clientInfo == null) {
            res.send(204);
            return;
          }
          var hipchatUrl = clientInfo.capabilitiesDoc.links['api'];
          addon.getAccessToken(clientInfo).then(
            function(token) {
              http.post(hipchatUrl + '/room/'+req.context.item.room.id+'/notification?auth_token=' + token.access_token,{
                "body": {
                  "message": "pong"
                },
                "json": true
              });
              res.send(200);
            }, function(err) {
              console.log("Unable to get access token: ", err);
              res.send(500, err);
            }
          )
        }, function(err) {
          res.send(500, err);
        }
      );
    }
  );

  // Add-on lifecycle events handlers... if you need them

  // addon.on('installed', function(id, tokenObj, ctx){
  //   console.log(2, ctx);
    // addon.loadClientInfo(tokenObj.clientKey).then(
    //   function(clientInfo) {
    //     if (clientInfo == null) {
    //       res.send(204);
    //       return;
    //     }
    //     var hipchatUrl = clientInfo.capabilitiesDoc.links['api'];
    //     addon.getAccessToken(clientInfo).then(
    //       function(token) {
    //         console.log(7,token);
    //         http.post(hipchatUrl + '/room/'+ctx.roomId+'/notification?auth_token=' + token.access_token,{
    //           "body": {
    //             "message": "so and so installed your addon"
    //           },
    //           "json": true
    //         }, function(err, res){
    //           console.log(6, arguments)
    //         });
    //         // res.send(200);
    //       }, function(err) {
    //         console.log("Unable to get access token: ", err);
    //         // res.send(500, err);
    //       }
    //     )
    //   }, function(err) {
    //     // res.send(500, err);
    //   }
    // );

  // });

  // addon.on('uninstalled', function(id){
  //   ...do something
  // });

};
