var loaderUtils = require("loader-utils");
var path = require('path');
var jsesc = require('jsesc');
var minify = require('html-minifier').minify;

module.exports = function (content) {
  this.cacheable && this.cacheable();
  var query = loaderUtils.parseQuery(this.query);
  var ngModule = query.module || 'ng'; // ng is the global angular module that does not need to explicitly required
  var relativeTo = query.relativeTo || '';
  var htmlminOptions = query.htmlmin || {
    removeComments: true,
    collapseWhitespace: true,
    // Note we must set it as false to avoid angular directive lose boolea expression while compile phase.
    // <div loop="true"></div> will be converted to <div loop></div>
    collapseBooleanAttributes: false
  };
  var prefix = query.prefix || '';
  var absolute = false;
  var pathSep = query.pathSep || '/';
  var resource = this.resource;
  var pathSepRegex = new RegExp(escapeRegExp(path.sep), 'g');

  // if a unix path starts with // we treat is as an absolute path e.g. //Users/wearymonkey
  // if we're on windows, then we ignore the / prefix as windows absolute paths are unique anyway e.g. C:\Users\wearymonkey
  if (relativeTo[0] == '/') {
    if (path.sep == '\\') { // we're on windows
      relativeTo = relativeTo.substring(1);
    } else if (relativeTo[1] == '/') {
      absolute = true;
      relativeTo = relativeTo.substring(1);
    }
  }

  // normalise the path separators
  if (path.sep != pathSep) {
    relativeTo = relativeTo.replace(pathSepRegex, pathSep);
    prefix = prefix.replace(pathSepRegex, pathSep);
    resource = resource.replace(pathSepRegex, pathSep)
  }

  var relativeToIndex = resource.indexOf(relativeTo);
  if (relativeToIndex === -1 || (absolute && relativeToIndex !== 0)) {
    throw 'The path for file doesn\'t contains relativeTo param';
  }

  var filePath = prefix + resource.slice(relativeToIndex + relativeTo.length); // get the base path
  var html;

  if (content.match(/^module\.exports/)) {
    var firstQuote = findQuote(content, false);
    var secondQuote = findQuote(content, true);
    html = content.substr(firstQuote, secondQuote - firstQuote + 1);
  } else {
    html = content;
  }

  /**
   * Convert template source Javascript-friendly lines
   * @param  {String} source Template source
   * @return {String}
   */
  function stringify(source) {
    return source.split(/^/gm).map(function (line) {
      return JSON.stringify(line);
    }).join(' +\n    ') || '""';
  };

  // 1. minify html.
  html = minify(html, htmlminOptions);

  // Convert template source Javascript-friendly lines
  html = stringify(html);

  return "var path = '" + jsesc(filePath) + "';\n" +
    "var html = " + html + ";\n" +
    "window.angular.module('" + ngModule + "').run(['$templateCache', function(c) { c.put(path, html) }]);\n" +
    "module.exports = path;";

  function findQuote(content, backwards) {
    var i = backwards ? content.length - 1 : 0;
    while (i >= 0 && i < content.length) {
      if (content[i] == '"' || content[i] == "'") {
        return i;
      }
      i += backwards ? -1 : 1;
    }
    return -1;
  }

  // source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Using_Special_Characters
  function escapeRegExp(string) {
    return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
  }
};
