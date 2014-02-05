require('newrelic');
var express = require('express');
var ac = require('atlassian-connect-express');
process.env.PWD = process.env.PWD || process.cwd(); // Fix expiry on Windows :(
var expiry = require('static-expiry');
var hbs = require('express-hbs');
var http = require('http');
var path = require('path');
var os = require('os');

ac.store.register('redis', require('atlassian-connect-express-redis'));

var staticDir = path.join(__dirname, 'public');
var viewsDir = __dirname + '/views';
var routes = require('./routes');
var app = express();
var addon = ac(app);

addon.API_BASE_URI = 'https://api.github.com';

// Load the HipChat AC compat layer
var hipchat = require('atlassian-connect-express-hipchat')(addon, app);

// Github OAuth
var passport = require('passport');
var GitHubStrategy = require('passport-github').Strategy;

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  addon.settings.get(id, 'github').then(function(d){
    done(null, d);
  });
});

passport.use(new GitHubStrategy({
    clientID: process.env['GH_ID'],
    clientSecret: process.env['GH_SECRET'],
    callbackURL: addon.config.localBaseUrl() + "/auth/github/callback",
    userAgent: 'hipchat.com'
  },
  function(accessToken, refreshToken, user, done) {
    user.accessToken = accessToken;
    user.refreshToken = refreshToken;
    addon.settings.set(user.id, user, 'github').then(function(d){
      done(null, user);
    }).catch(function(err){
      done(err, user);
    });
  }
));

var port = addon.config.port();
var devEnv = app.get('env') == 'development';

app.set('port', port);

app.engine('hbs', hbs.express3({partialsDir: viewsDir}));
app.set('view engine', 'hbs');
app.set('views', viewsDir);

app.use(express.favicon());
app.use(express.logger(devEnv ? 'dev' : 'default'));
app.use(express.compress());
app.use(express.urlencoded())
app.use(express.json())
app.use(express.cookieParser());

app.use(passport.initialize());
addon.passport = passport;

app.use(addon.middleware());

app.use(expiry(app, {dir: staticDir, debug: devEnv}));
hbs.registerHelper('furl', function(url){ return app.locals.furl(url); });
app.use(app.router);
app.use(express.static(staticDir));

if (devEnv) app.use(express.errorHandler());

routes(app, addon);

http.createServer(app).listen(port, function(){
  console.log()
  console.log('Add-on server running at '+ (addon.config.localBaseUrl()||('http://' + (os.hostname()) + ':' + port)));
  // Enables auto registration/de-registration of add-ons into a host in dev mode
  if (devEnv) addon.register();
});
