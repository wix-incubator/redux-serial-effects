// Generated by BUCKLESCRIPT VERSION 4.0.18, PLEASE EDIT WITH CARE
'use strict';

var Block = require("bs-platform/lib/js/block.js");
var Js_types = require("bs-platform/lib/js/js_types.js");

function isPromise(p) {
  var match = Js_types.classify(p);
  if (typeof match === "number" || match.tag !== 3) {
    return false;
  } else {
    var match$1 = Js_types.classify(p.then);
    if (typeof match$1 === "number" || match$1.tag !== 2) {
      return false;
    } else {
      return true;
    }
  }
}

function classifyValueOrPromise(valueOrPromise) {
  var match = isPromise(valueOrPromise);
  if (match) {
    return /* Promise */Block.__(1, [valueOrPromise]);
  } else {
    return /* Value */Block.__(0, [valueOrPromise]);
  }
}

exports.isPromise = isPromise;
exports.classifyValueOrPromise = classifyValueOrPromise;
/* No side effect */
