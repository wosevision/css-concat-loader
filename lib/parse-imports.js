var Promise = require('es6-promise').Promise;
var stripCssComments = require('strip-css-comments');
var _ = require('lodash');
var path = require('path');
var fs = require('fs');

//TODO: add response of map file
module.exports = function (filename, content, config) {
  var result = {
    css: '',
    urls: [],
    map: null
  }

  var imported = [];

  function readFile(filename) {
    try {
      return fs.readFileSync(filename, {'encoding': 'utf-8'});
    } catch (err) {
      return null;
    }
  }

  function resolveUrl(url, baseUrl, context) {
    if (/^\/|[a-z][a-z.+-]*:/i.test(url)) {
      return url;
    }
    return path.relative(context, path.resolve(baseUrl, url));
  }

  function findImports(filename, source) {
    // if already imported don't do anything
    if (imported.indexOf(filename) >= 0) {
      return '';
    }
    imported.push(filename);

    var match = true;
    var imports = [];
    var basePath = path.dirname(filename);
    var importRegExp = /^\s*@import\s+(\([^\)]+\)\s+)?(url\()?\s*("|')(.+)\s*("|')(\))?\s*;.*$/gm;
    var source = stripCssComments(source);

    // loop through source if an "@import" match has been found.
    while(match) {
      match = importRegExp.exec(source);

      // if a match ahs been found parse it
      if (match) {
        var importUrl = match[4];
        var importFile = path.resolve(basePath, importUrl)
        var optional = /optional/.test(match[1]);
        var found = false;
        var fileLookup = [];

        // create a fileLookup array to find matches when the file doesn't have an extension
        if (path.extname(importFile) !== '') {
          fileLookup.push(importFile);
        } else {
          fileLookup = _.map(config.extensions, function (ext) {
            return importFile + ext;
          });
        }

        // loop through the fileLookup array and check if the file exists
        for (var i = 0; i < fileLookup.length && !found; i++) {
          var content = readFile(fileLookup[i]);
          if (content !== null) {
            var output = findImports(fileLookup[i], content);
            source = source.substr(0, match.index) + output + source.substr(match.index + match[0].length);
            importRegExp.lastIndex = match.index + output.length;
            found = true;
          }
        }

        // if the import was not found and wasn't marked as optional then error out
        if (!found && !optional) {
          throw new Error(importUrl + ' wasn\'t found in ' + filename + '. Tried - ' + fileLookup.join(', '));
        }
      }
    }

    // if resolveUrls is set then resolve the urls to a specific baseUrl
    if (config.resolveUrls) {
      return source.replace(/url\s*\(\s*(['"]?)((?!\s*(data:|@))[^"'\)]*)\1\s*\)/gi, function (m, q, url) {
        var relUrl = resolveUrl(url, config.baseUrl || basePath, config.context);

        var id = result.urls.indexOf(relUrl);
        if (id === -1) id = result.urls.length;

        result.urls.push(relUrl);
        return '___CSS_LOADER_URL___' + id + '___';
      });
    }

    return source;
  }

  result.css = findImports(filename, content);

  return result;
};
