// # The Interpreter
// 
// The interpreter part of our language is where we'll evaluate the nodes to execute the program.
// Thus the name `eval` for the function we'll be defining here.
//
// We'll add an `eval` function to each node produced by the parser. Each node will know how to
// evaluate itself. For example, a `StringNode` will know how to turn itself into a real string
// inside our runtime.
//
// One thing our interpreter does not support is variable declaration hoisting. In JavaScript,
// variable declarations are moved (hoisted) invisibly to the top of their scope. This would
// require two passes in the node tree by the interpreter, a first one for declaring and one
// last one for evaluating.

var nodes = require('./nodes');
var runtime = require('./runtime');

// The top node of a tree will always be of type `BlockNode`. Its job is to spread the call to
// `eval` to each of its children.

nodes.BlockNode.prototype.eval = function(scope) {
  this.nodes.forEach(function(node) {
    node.eval(scope);
  });
}

// Literals are pretty easy to eval. Simply return the runtime value.

nodes.ThisNode.prototype.eval      = function(scope) { return scope.this; }
nodes.TrueNode.prototype.eval      = function(scope) { return runtime.true; }
nodes.FalseNode.prototype.eval     = function(scope) { return runtime.false; }
nodes.NullNode.prototype.eval      = function(scope) { return runtime.null; }
nodes.UndefinedNode.prototype.eval = function(scope) { return runtime.undefined; }

// Creating various objects is done by instanciating `JsObject`.

nodes.ObjectNode.prototype.eval = function(scope) { return new runtime.JsObject(); }
nodes.StringNode.prototype.eval = function(scope) { return new runtime.JsObject(this.value); }
nodes.NumberNode.prototype.eval = function(scope) { return new runtime.JsObject(this.value); }


// Variables are stored in the current scope. All we need to do to interpret the variable nodes is
// get and set values in the scope.

nodes.DeclareVariableNode.prototype.eval = function(scope) {
  return scope.locals[this.name] = this.valueNode ? this.valueNode.eval(scope) : runtime.undefined;
}

nodes.GetVariableNode.prototype.eval = function(scope) {
  var value = scope.get(this.name);
  if (typeof value === "undefined") throw this.name + " is not defined";
  return value;
}

nodes.SetVariableNode.prototype.eval = function(scope) {
  return scope.set(this.name, this.valueNode.eval(scope));
}


// Getting and setting properties is handled by the two following nodes.
// One gotcha to note here. We want to make sure to not inject real JavaScript values,
// such as a string, number, `true`, `null` or `undefined` inside the runtime.
// Instead, we want to always return values created for our runtime. For example here,
// we make sure to return `runtime.undefined` and not `undefined` if the property is
// not set. 

nodes.GetPropertyNode.prototype.eval = function(scope) {
  return this.objectNode.eval(scope).get(this.name) || runtime.undefined;
}

nodes.SetPropertyNode.prototype.eval = function(scope) {
  return this.objectNode.eval(scope).set(this.name, this.valueNode.eval(scope));
}


// Creating a function is just a matter of instanciating `JsFunction`.

nodes.FunctionNode.prototype.eval = function(scope) {
  return new runtime.JsFunction(this.parameters, this.bodyNode);
}

// Calling a function can take two forms:
//
// 1. On an object: `object.name(...)`. `this` will be set to `object`.
// 2. On a variable: `name(...)`. `this` will be set to the `root` object.

nodes.CallNode.prototype.eval = function(scope) {
  if (this.objectNode) { // object.name(...)
    var object = this.objectNode.eval(scope);
    var theFunction = object.get(this.name);
  } else { // name()
    var object = runtime.root;
    var theFunction = scope.get(this.name);
  }

  var args = this.argumentNodes.map(function(arg) { return arg.eval(scope) });

  if (!theFunction || !theFunction.call) throw this.name + " is not a function";

  return theFunction.call(object, scope, args) || runtime.undefined;
}
