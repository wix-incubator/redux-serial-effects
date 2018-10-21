// Generated by BUCKLESCRIPT VERSION 4.0.18, PLEASE EDIT WITH CARE
'use strict';

var List = require("bs-platform/lib/js/list.js");
var Curry = require("bs-platform/lib/js/curry.js");
var Effect$ReduxSerialEffects = require("./Effect.bs.js");
var Result$ReduxSerialEffects = require("./Result.bs.js");
var Registrar$ReduxSerialEffects = require("./Registrar.bs.js");
var SubscriberResult$ReduxSerialEffects = require("./SubscriberResult.bs.js");

var SubscribersRegistrar = Registrar$ReduxSerialEffects.Make(/* module */[]);

function create(param) {
  var match = Curry._1(SubscribersRegistrar[/* create */1], /* () */0);
  var getListeners = match[1];
  var callSubscribers = function (transition) {
    return List.map((function (subscriber) {
                  return Result$ReduxSerialEffects.try_((function (param) {
                                return Effect$ReduxSerialEffects.subscriberResultToEffects(SubscriberResult$ReduxSerialEffects.fromJs(Curry._1(subscriber, transition)));
                              }));
                }), Curry._1(getListeners, /* () */0));
  };
  return /* tuple */[
          match[0],
          callSubscribers
        ];
}

exports.SubscribersRegistrar = SubscribersRegistrar;
exports.create = create;
/* SubscribersRegistrar Not a pure module */
