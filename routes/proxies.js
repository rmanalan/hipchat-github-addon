var http = require('request').defaults({
  json: true,
  headers: {
    'User-Agent': 'HipChat/GitHub Connector'
  }
});
var render = require('../lib/messageRenderer')({
  templateDir: "./views/messages"
});

module.exports = function (app, addon) {
  var hipchat = require('../lib/hipchat')(addon);

  app.post('/gh/incoming', function(req, res){
    function send(msg){
      hipchat.sendMessage(req.query.i, req.query.room_id, msg).then(function(data){
        console.log('msg sent')
        res.send(200);
      }).catch(function(err){
        addon.logger.error(err);
        res.send(500);
      });
    }

    var event = req.headers['x-github-event'];
    var data = req.body;
    addon.logger.info('Received',event);
    // Based on the 'web' events listed on https://api.github.com/hooks
    if (event === 'commit_comment') {
      send(render('commit_comment', data));
    } else if (event === 'create') {
    } else if (event === 'delete') {
    } else if (event === 'deployment') {
    } else if (event === 'deployment_status') {
    } else if (event === 'fork') {
    } else if (event === 'gollum') {
      send(render('gollum', data));
    } else if (event === 'issue_comment') {
      send(render('issue_comment', data));
    } else if (event === 'issues') {
      send(render('issues', data));
    } else if (event === 'member') {
    } else if (event === 'pull_request') {
      send(render('pull_request', data));
    } else if (event === 'pull_request_review_comment') {
      send(render('pull_request_review_comment', data));
    } else if (event === 'push') {
      data.branch = data.ref.split('/')[2];
      send(render('push',data));
    } else if (event === 'release') {
      send(render('release',data));
    } else if (event === 'status') {
    } else if (event === 'team_add') {
    } else if (event === 'watch') {
      send(render('watch', data));
    }
    // } else if (event === 'download') {
    // } else if (event === 'follow') {
    // } else if (event === 'fork_apply') {
    // } else if (event === 'gist') {
    // } else if (event === 'public') {
  });

  // Proxy route to GH's /repos/:owner/:repo/hooks
  app.post('/gh/hooks',
    addon.authenticate(),
    function(req,res){
      http.post({
        uri: addon.API_BASE_URI + '/repos/' + req.body.repo + '/hooks',
        qs: {
          access_token: req.clientInfo.githubAccessToken
        },
        body: {
          name: 'web',
          config: {
            url: process.env.AC_LOCAL_BASE_URL + '/gh/incoming?room_id=' + req.context.roomId + '&i=' + req.clientInfo.clientKey,
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
      }, function(err, resp, body){
        res.json(body);
      });
    }
  );
}