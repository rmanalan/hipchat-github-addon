var jwt = require('jwt-simple');
var url = require('url');
var qs = require('qs');
var http = require('request').defaults({
  json: true,
  headers: {
    'User-Agent': 'HipChat/GitHub Connector'
  }
});

module.exports = function (app, addon) {

  function authWithQueryAsState(req, res, next) {
    addon.passport.authenticate('github',{ session: false, scope: ['repo'], state: qs.stringify(req.query) })(req, res, next);
  }
  
  function getDomain(url){
	  var indexOfDot = url.lastIndexOf(".");
	  return url.substring(0, indexOfDot) + url.substring(indexOfDot).split('/')[0] + '/api/v3'
  }
  
  function getBaseUrl(clientInfo){
	  var baseUrl = addon.API_BASE_URI;
	  if(clientInfo.baseUrl){
		  baseUrl = clientInfo.baseUrl;
	  }
	  return baseUrl;
  } 
  
  function setGithubUserId(signedRequest, userId){
      var unverifiedClaims = jwt.decode(signedRequest, null, true);
      var issuer = unverifiedClaims.iss;
      addon.loadClientInfo(issuer).then(function(clientInfo){
    	  clientInfo.githubUserId = userId;
    	  addon.settings.set('clientInfo', clientInfo, issuer);
      });
      return;
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
        var now = Math.floor(Date.now()/1000);
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
        clientInfo.baseUrl = addon.API_BASE_URI;
        addon.settings.set('clientInfo', clientInfo, issuer).then(function(clientInfo){
          res.render('auth_success');
        });

      }, function(err) {
        return send(400, err.message);
      });
    }
  );
  
  app.get('/auth/github-enterprise',
	addon.authenticate(),
	function(req, res){
      var signedRequest = req.query.signed_request;
      var unverifiedClaims = jwt.decode(signedRequest, null, true);
      var issuer = unverifiedClaims.iss;
      var clientDetails = {"domain": getDomain(req.query.domain), "accessToken": req.query.access_token};
      
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
          
          clientInfo.githubAccessToken = clientDetails['accessToken'];
          clientInfo.baseUrl = clientDetails['domain'];
          addon.settings.set('clientInfo', clientInfo, issuer).then(function(clientInfo){
            res.render('auth_success');
          });

        }, function(err) {
          return send(400, err.message);
        });      
   	}
  );
  
  app.get('/switch-acccount',
	addon.authenticate(),
	function(req, res){
	  var signedRequest = req.query.signed_request;
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
          
          delete clientInfo['githubAccessToken'];
          delete clientInfo['baseUrl'];
          delete clientInfo['githubUserId:']
          addon.settings.set('clientInfo', clientInfo, issuer).then(function(clientInfo){
        	  res.render('login');
          });
        }, function(err) {
          return send(400, err.message);
        });
  	}  
  );
  
  
  return {
    ensureAuthenticated: function() {
      return function (req, res, next) {
    	  if (!req.clientInfo.baseUrl){
    		  res.render('login');
              return;
    	  }

    	http.get({
          uri: getBaseUrl(req.clientInfo) + '/user',
          qs: {
            access_token: req.clientInfo.githubAccessToken
          },
          rejectUnauthorized:false
        }, function(err, resp, body){
          var param = {};
          if(req.clientInfo.baseUrl != addon.API_BASE_URI){
      		param["error"] = true
      	  }
          if(err){  
            res.render('login', param);
            return;
          }
          if(body.id && !req.clientInfo.githubUserId){
        	  setGithubUserId(req.query.signed_request, body.id);
        	  return next();
    	  }
          if (req.clientInfo.githubUserId && req.clientInfo.githubUserId === body.id) {
            return next();
          } else {
            res.render('login', param);
            return;
          }
        });

      }
    }
  }

};
