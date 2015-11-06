var Handlebars = require('handlebars');
var path = require('path');
var fs = require('fs');
var _ = require('lodash');
var summarize = require('summarizely');

exports = module.exports = function(opts){
  opts = _.extend({
    templateExt: ".hbs",
    templateDir: path.join(__dirname, './templates'),
    noColors: false,
    terseEvents: [
      "commit_comment",
      "deployment",
      "deployment_status",
      "issue_comment",
      "issues",
      "member",
      "pull_request",
      "pull_request_review_comment",
      "push",
      "release"
    ],
    terseCommentPath: 'terse'
  }, opts);

  function loadTemplate(name, cb){
    try{
      console.log(name);
      return fs.readFileSync(path.join(opts.templateDir,name+opts.templateExt)).toString();
    } catch(err) {
      console.error("Error:", err)
    }
  }

  function resolveEventPath(event, terseComments) {
    if (terseComments && opts.terseEvents.indexOf(event) >= 0) {
      return path.join(opts.terseCommentPath, event)
    }
    return event
  }

  Handlebars.registerHelper('trim', function(passedString, options) {
    var length = 10;
    if (options.hash && options.hash.length) {
      length = options.hash.length;
    }
    var theString = passedString.substring(0, length);
    return new Handlebars.SafeString(theString);
  });

  Handlebars.registerHelper('ltrim', function(passedString, options) {
    var length = 10;
    if (options.hash && options.hash.length) {
      length = options.hash.length;
    }
    var theLength = passedString.length;
    var theString = '...' + passedString.substring(theLength - length, theLength);
    return new Handlebars.SafeString(theString);
  });

  Handlebars.registerHelper('summarize', function(content) {
    var summary = summarize(content.replace(/\r?\n|\r/g,' '));
    return new Handlebars.SafeString(summary.slice(0,1).join('') + '... ');
  });

  Handlebars.registerHelper('escapeQuotes', function(opts) {
    return new Handlebars.SafeString(JSON.stringify(opts.fn(this).toString()));
  });

  Handlebars.registerHelper('summarizeBlock', function(opts) {
    var summary = summarize(opts.fn(this).replace(/(\r\n|\n|\r|\\n)/gm,' '));
    return new Handlebars.SafeString(summary.slice(0,1).join('') + '... ');
  });

  Handlebars.registerHelper('nonewlines', function(content) {
    var summary = content.replace(/(\r\n|\n|\r)/gm,"\\n");
    return new Handlebars.SafeString(summary);
  });

  Handlebars.registerHelper('extractBranch', function(passedString) {
    var arry = passedString.split('/');
    var out = arry[arry.length - 1];
    return new Handlebars.SafeString(out);
  });

  Handlebars.registerHelper('ifCond', function(v1, v2, options) {
    if(v1 === v2) {
      return options.fn(this);
    }
    return options.inverse(this);
  });

  Handlebars.registerHelper('ifIsTruthy', function(value, options) {
    if (!!value) {
      return options.fn(this);
    }
    return options.inverse(this);
  });

  Handlebars.registerHelper('pluralize', function(number, single, plural) {
    if (number === 1) { return single; }
    else { return plural; }
  });

  Handlebars.registerHelper('blockquote', function(passedString) {
    var theString = '<i>' + passedString.replace(/\r\n\r/g,"</i><br><br><i>") + '</i>';
    return new Handlebars.SafeString(theString);
  });

  return function render(templateName, context, terseComments){
    var ctx = {};
    if (typeof context === 'object') ctx = context;
    ctx.localBaseUrl = opts.localBaseUrl;
    var renderedStr = Handlebars.compile(loadTemplate(resolveEventPath(templateName, terseComments)),{noEscape: true})(ctx);
    console.log(renderedStr);
    return JSON.parse(renderedStr);
  }
}