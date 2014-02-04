var RSVP = require('rsvp');
var _ = require('lodash');
var http = require('request').defaults({
  json: true,
  headers: {
    'User-Agent': 'HipChat/GitHub Connector'
  }
});
var auth = require('./auth');

function newRepo(repo){
  return {
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description,
    event: {
      branchtag: true,
      commit_comment: true,
      deployment: true,
      deployment_status: true,
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
      restrict_to_branch: '',
      color: 'yellow'
    }
  }
}

function newHook(roomId, token){
  return {
    name: 'web',
    config: {
      url: process.env.AC_LOCAL_BASE_URL + '/incoming?r=' + roomId + '&i=' + token,
      secret: 'changeme',
      content_type: 'json',
      ssl_version: '3.0',
      insecure_ssl: false
    },
    events: [
      "commit_comment",
      "create",
      "delete",
      "deployment",
      "deployment_status",
      "download",
      "follow",
      "fork",
      "fork_apply",
      "gist",
      "gollum",
      "issue_comment",
      "issues",
      "member",
      "public",
      "pull_request",
      "pull_request_review_comment",
      "push",
      "release",
      "status",
      "team_add",
      "watch"
    ],
    'active': true
  }
}

module.exports = function(app, addon) {
  var githubAuth = auth(app, addon);
  var gh = {};

  gh.get = function(uri, accessToken){
    return new RSVP.Promise(function(resolve, reject){
      http.get({
        uri: addon.API_BASE_URI + uri,
        qs: {
          access_token: accessToken
        },
      }, function(err, resp, body){
        if(err){
          reject(err);
          return;
        }
        resolve(resp);
      });
    });
  }

  gh.post = function(uri, accessToken, data){
    return new RSVP.Promise(function(resolve, reject){
      http.post({
        uri: addon.API_BASE_URI + uri,
        qs: {
          access_token: accessToken
        },
        body: data
      }, function(err, resp, body){
        if(err){
          reject(err);
          return;
        }
        resolve(resp);
      });
    });
  }

  gh.delete = function(uri, accessToken){
    return new RSVP.Promise(function(resolve, reject){
      http.del({
        uri: addon.API_BASE_URI + uri,
        qs: {
          access_token: accessToken
        }
      }, function(err, resp, body){
        if(err){
          reject(err);
          return;
        }
        resolve(resp);
      });
    });
  }

  // Config page
  app.get('/config',
    addon.authenticate(),
    githubAuth.ensureAuthenticated(),
    function(req, res) {
      res.render('config', req.context);
    }
  );

  // Add new subscription
  app.post('/repos', addon.authenticate(), function(req, res){
    var repoNameArry = req.body.repoName.split('/');
    var user = repoNameArry[0];
    var repoName = repoNameArry[1];
    var repo = {};
    var hooks;
    var errCode = 500;
    // Get repo details
    gh.get('/repos/' + user + '/' + repoName, req.clientInfo.githubAccessToken)
      .then(function(resp){
        // All registered hooks
        addon.logger.info('> Getting repo details');
        repo = resp.body;
        return gh.get('/repos/' + user + '/' + repoName + '/hooks', req.clientInfo.githubAccessToken);
      })
      .then(function(h){
        hooks = h;
        // Delete existing HipChat hook if it exists
        var hcHook = _.find(hooks.body, {name: 'hipchat'});
        if (hcHook) {
          addon.logger.info('> Deleting HipChat hook');
          return gh.delete('/repos/' + user + '/' + repoName + '/hooks/' + hcHook.id, req.clientInfo.githubAccessToken);
        }
      })
      .then(function(){
        // Delete existing HC/GH Add-on webhook if it exists
        var re = new RegExp(process.env.AC_LOCAL_BASE_URL.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
        var webhook = _.find(hooks.body, function(h){
          return h.name === 'web' && re.test(h.config.url);
        });
        if (webhook) {
          addon.logger.info('> Deleting HC/GH add-on hook');
          return gh.delete('/repos/' + user + '/' + repoName + '/hooks/' + webhook.id, req.clientInfo.githubAccessToken);
        }
        return;
      })
      .then(function(){
        // Create new hook
        addon.logger.info('> Creating new HC/GH add-on hook');
        var data = newHook(req.context.roomId, req.clientInfo.clientKey);
        return gh.post('/repos/' + user + '/' + repoName + '/hooks', req.clientInfo.githubAccessToken, data);
      })
      .then(function(newHook){
        if(newHook.statusCode !== 201){
          errCode = newHook.statusCode;
          throw newHook.body;
        } else {
          return newHook;
        }
      })
      .then(function(newHook){
        // Register new hook
        var repoToSave = newRepo(repo);
        repoToSave.gh_id = newHook.body.id;
        addon.logger.info('> Saving new subscription');
        addon.settings.set('repos:' + repoToSave.id, repoToSave, req.clientInfo.clientKey).then(function(d){
          res.json(repoToSave);
        });
      })
      .catch(function(err){
        addon.logger.error(err);
        res.json(500, err);
      });
  });

  // Update a subscription
  app.put('/repos/:id', addon.authenticate(), function(req, res){
    addon.settings.set('repos:' + req.params.id, req.body, req.clientInfo.clientKey).then(function(d){
      res.json(req.body);
    });
  });

  // Delete a subscription
  app.delete('/repos/:id', addon.authenticate(), function(req, res){
    addon.settings.get('repos:' + req.params.id, req.clientInfo.clientKey)
      .then(function(d){
        addon.logger.info('> Deleting webhook on GitHub');
        return gh.delete('/repos/' + d.full_name + '/hooks/' + d.gh_id, req.clientInfo.githubAccessToken);
      })
      .then(function(){
        addon.logger.info('> Deleting subscription');
        addon.settings.del('repos:' + req.params.id, req.clientInfo.clientKey).then(function(d){
          res.json(d);
        });
      })
      .catch(function(err){
        addon.logger.error(err);
        res.json(500, err);
      });
  });

  // List all repo subscriptions
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
