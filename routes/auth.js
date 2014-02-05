var jwt = require('jwt-simple');
var url = require('url');
var qs = require('qs');

module.exports = function (app, addon) {

  function authWithQueryAsState(req, res, next) {
    addon.passport.authenticate('github',{ session: false, scope: ['repo'], state: qs.stringify(req.query) })(req, res, next);
  }

  app.get('/auth/github', authWithQueryAsState);

  app.get('/auth/github/callback',
    addon.passport.authenticate('github', { failureRedirect: '/auth' }),
    function(req, res){
      var state = qs.parse(req.query.state);
      var signedRequest = state.signed_request;
      var unverifiedClaims = jwt.decode(signedRequest, null, true);
      var issuer = unverifiedClaims.iss;

      addon.loadClientInfo(issuer).then(function(clientInfo){
        // verify the signed request
        if (clientInfo === null) {
          return send(400, "Request can't be verified without an OAuth secret");
        }
        var verifiedClaims = jwt.decode(signedRequest, clientInfo.oauthSecret);

        // JWT expiry can be overriden using the `validityInMinutes` config.
        // If not set, will use `exp` provided by HC server (default is 1 hour)
        var now = Math.floor(Date.now()/1000);;
        if (addon.config.maxTokenAge()) {
          var issuedAt = verifiedClaims.iat;
          var expiresInSecs = addon.config.maxTokenAge() / 1000;
          if(issuedAt && now >= (issuedAt + expiresInSecs)){
            send(401, 'Authentication request has expired.');
            return;
          }
        } else {
          var expiry = verifiedClaims.exp;
          if (expiry && now >= expiry) { // default is 1 hour
            send(401, 'Authentication request has expired.');
            return;
          }
        }
        clientInfo.githubUserId = req.user.id;
        clientInfo.githubAccessToken = req.user.accessToken;
        addon.settings.set('clientInfo', clientInfo, issuer).then(function(clientInfo){
          res.render('auth_success');
        });

      }, function(err) {
        return send(400, err.message);
      });
    }
  );

  return {
    ensureAuthenticated: function() {
      return function (req, res, next) {
        if (req.clientInfo.githubUserId) { return next(); }
        res.render('login');
      }
    }
  }

};
