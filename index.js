/**
 * Module dependencies
 */

var parser = require('directiv-core-parser');
var read = require('fs').readFileSync;
var template = read(__dirname + '/templates/routes.js', 'utf8');
var dep = read(__dirname + '/templates/dependency.js', 'utf8');
var hash = require('crypto').createHash.bind(null, 'sha1');

module.exports = routes;

function routes(source) {
  this.cacheable && this.cacheable();
  var ast = parser(source);
  var conf = {
    modules: {}
  };
  traverse(conf, ast);

  var DEPS = formatDependencies(conf.modules);
  var INIT = formatInit(conf.modules);
  var AST = formatAst(conf.modules, ast[0]);
  var str = template
    .replace('AST', AST)
    .replace('INITIALIZATION', INIT)
    .replace('DEPENDENCIES', DEPS);
  return str;
}

function traverse(conf, ast) {
  if (Array.isArray(ast)) return ast.forEach(traverse.bind(null, conf));
  var mod = ast.props.module;
  if (!mod && needsModule(ast.tag)) throw new Error('Missing module path in routes.html for route:\n<' + ast.raw + '>');

  if (mod && !conf.modules[mod]) {
    var fn = 'fn' + hash().update(mod).digest('hex');
    conf.modules[mod] = {
      module: mod,
      fn: fn + 'Scoped',
      init: fn
    };
  }
  traverse(conf, ast.children || []);
}

function needsModule(tag) {
  return tag === 'route' ||
         tag === 'route-default' ||
         tag === 'route-not-found' ||
         tag === 'route-error';
}

function formatDependencies(modules) {
  return Object.keys(modules).map(function(mod) {
    return formatDependency(modules[mod]);
  }).join('\n');
}

function formatDependency(mod) {
  var DEVELOPMENT = process.env.NODE_ENV === 'development';
  var PRE = DEVELOPMENT ?
        '' :
        'require.ensure([MODULE], function(require) {';
  var POST = DEVELOPMENT ?
        '' :
        '});';
  var RETURN_VALUE = DEVELOPMENT ?
        'return render(state);' :
        'if (render) return ready();';
  return dep
    .replace('RETURN_VALUE', RETURN_VALUE)
    .replace('PRE_WRAPPER', PRE)
    .replace('POST_WRAPPER', POST)
    .replace(/MODULE/g, JSON.stringify('directiv-util-module-loader!' + mod.module))
    .replace(/FUNCTION/g, mod.init);
}

function formatInit(modules) {
  return Object.keys(modules).map(function(name) {
    var mod = modules[name];
    return 'var ' + mod.fn + ' = ' + mod.init + '(update, Template, modules);';
  }).join('\n');
}

function formatAst(modules, ast) {
  if (Array.isArray(ast)) return ast.map(formatAst.bind(null, modules)).join(', ');
  switch(ast.tag) {
    case 'routes':
      return formatRoutes(modules, ast);
      break;
    case 'route':
      return formatRoute(modules, ast);
      break;
    case 'route-default':
      return formatDefault(modules, ast);
      break;
    case 'route-error':
      return formatError(modules, ast);
      break;
    case 'route-not-found':
      return formatNotFound(modules, ast);
      break;
  };
  throw new Error('Unsupported tag: <' + ast.raw + '/>');
}

function formatRoutes(modules, node) {
  return 'Routes(' + JSON.stringify(node.props) + formatChildren(modules, node) + ')';
}

function formatRoute(modules, node) {
  return 'Route(' + formatProps(modules, node) + formatChildren(modules, node) + ')';
}

function formatNotFound(modules, node) {
  return 'RouteNotFound(' + formatProps(modules, node) + formatChildren(modules, node) + ')';
}

function formatError(modules, node) {
  return 'RouteError(' + formatProps(modules, node) + formatChildren(modules, node) + ')';
}

function formatDefault(modules, node) {
  return 'RouteDefault(' + formatProps(modules, node) + formatChildren(modules, node) + ')';
}

function formatProps(modules, node) {
  var mod = node.props.module;
  var fn = modules[node.props.module].fn;
  var str = JSON.stringify(node.props);
  return str.replace('"' + mod + '"', fn);
};

function formatChildren(modules, node) {
  if (!node.children || node.children.length === 0) return '';
  return ', ' + formatAst(modules, node.children || []);
}
