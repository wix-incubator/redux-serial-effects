external exnToPromiseError: Js.Exn.t => Js.Promise.error = "%identity";
external promiseErrorToExn: Js.Promise.error => Js.Exn.t = "%identity";
external anyToObject: 'a => Js.t('b) = "%identity";
external valueToPromise: 'a => Js.Promise.t('a) = "%identity";

type valueOrPromise('a) =
  | Value('a)
  | Promise(Js.Promise.t('a));

let isPromise = p =>
  switch (Js.Types.classify(p)) {
  | JSObject(_) =>
    switch (Js.Types.classify(anyToObject(p)##_then)) {
    | JSFunction(_) => true
    | _ => false
    }
  | _ => false
  };

let classifyValueOrPromise = valueOrPromise =>
  isPromise(valueOrPromise) ?
    Promise(valueToPromise(valueOrPromise)) : Value(valueOrPromise);