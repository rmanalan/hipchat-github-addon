var jwt = require('jwt-simple');
var url = require('url');

module.exports = function (app, addon, passport) {

  app.get('/auth/github', passport.authenticate('github',{ session: false}));

  app.get('/auth/github/callback',
    passport.authenticate('github', { failureRedirect: '/auth' }),
    function(req, res){
      // Here's what's going on here:
      //
      // * We get the jwt from the referer header so we can get the
      //   clientId. We're doing it this way because we're not using sessions
      // * Once we have the clientId, we can fetch the clientInfo from Redis
      // * We then augment the clientInfo in Redis with the GitHub userid
      //   and accessToken
      var referer = req.headers['referer'];
      var signedRequest = url.parse(referer, true).query.signed_request;
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
