var Handlebars = require('handlebars');
var path = require('path');
var fs = require('fs');
var _ = require('lodash');
var summarize = require('summarizely');

exports = module.exports = function(opts){
  opts = _.extend({
    templateExt: ".hbs",
    templateDir: path.join(__dirname, './templates'),
    noColors: false
  }, opts);

  function loadTemplate(name, cb){
    try{
      return fs.readFileSync(path.join(opts.templateDir,name+opts.templateExt)).toString();
    } catch(err) {
      console.error("Error:", err)
    }
  }

  Handlebars.registerHelper('trim', function(passedString) {
    var theString = passedString.substring(0,10);
    return new Handlebars.SafeString(theString);
  });

  Handlebars.registerHelper('summarize', function(content) {
    var summary = summarize(content);
    return new Handlebars.SafeString(summary.slice(0,1).join('') + '... ');
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

  Handlebars.registerHelper('pluralize', function(number, single, plural) {
    if (number === 1) { return single; }
    else { return plural; }
  });

  Handlebars.registerHelper('blockquote', function(passedString) {
    var theString = '<i>' + passedString.replace(/\r\n\r/g,"</i><br><br><i>") + '</i>';
    return new Handlebars.SafeString(theString);
  });

  return function render(templateName,context){
    var ctx = {};
    if (typeof context === 'object') ctx = context;
    var renderedStr = Handlebars.compile(loadTemplate(templateName),{noEscape: true})(ctx);
    return renderedStr;
  }
}