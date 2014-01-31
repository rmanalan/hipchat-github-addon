var RSVP = require('rsvp');
var http = require('request').defaults({
  json: true,
  headers: {
    'User-Agent': 'HipChat/GitHub Connector'
  }
});
var auth = require('./auth');

module.exports = function(app, addon) {
  var githubAuth = auth(app, addon);

  app.get('/config',
    addon.authenticate(),
    githubAuth.ensureAuthenticated(),
    function(req, res) {
      res.render('config', req.context);
    }

  );

  app.post('/repos', addon.authenticate(), function(req, res){
    var repoNameArry = req.body.repoName.split('/');
    var user = repoNameArry[0];
    var repo = repoNameArry[1];
    http.get({
      uri: addon.API_BASE_URI + '/repos/' + user + '/' + repo,
      qs: {
        access_token: req.clientInfo.githubAccessToken,
        type: 'user'
      },
    }, function(err, resp, body){
      if(err){
        res.json(resp.statusCode, body);
        return;
      }
      if(resp.statusCode === 404){
        res.json(resp.statusCode, resp.body);
        return;
      }
      var newRepo = {
          id: body.id,
          name: body.name,
          full_name: body.full_name,
          description: body.description,
          event: {
              branchtag: true,
              commit_comment: true,
              fork: true,
              issues: true,
              issue_comment: true,
              member: true,
              pull_request: true,
              pull_request_review_comment: true,
              push: true,
              release: true,
              watch: true,
              status: true,
              team_add: true,
              gollum: true
          },
          options: {
              notify: false,
              limit_to_branches: ''
          }
      }
      addon.settings.set('repos:' + newRepo.id, newRepo, req.clientInfo.clientKey).then(function(d){
        res.json(newRepo);
      });
    })
  });

  app.put('/repos/:id', addon.authenticate(), function(req, res){
    addon.settings.set('repos:' + req.params.id, req.body, req.clientInfo.clientKey).then(function(d){
      res.json(req.body);
    });
  });

  app.delete('/repos/:id', addon.authenticate(), function(req, res){
    addon.settings.del('repos:' + req.params.id, req.clientInfo.clientKey).then(function(d){
      res.json(d);
    });
  });

  app.get('/repos', addon.authenticate(), function(req, res){
    addon.settings.client.multi()
      .keys(req.clientInfo.clientKey + ':repos:*', function(err, rep){
        addon.settings.client.mget(rep, function(err, rep){
          try {
            res.json(rep.map(JSON.parse));
          } catch(e){
            if (e instanceof TypeError) {
              res.json([]);
            } else {
              res.json(500);
            }
          }
        })
      })
      .exec(function(err, rep){
        if(err) {
          addon.logger.error(err);
        }
      });
  });

}
