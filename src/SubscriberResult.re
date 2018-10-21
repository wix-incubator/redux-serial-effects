type js_t;
type t('a) = option(array(Js.t('a)));

external absObjectToArray: Js.Types.obj_val => array('a) = "%identity";
external absObjectToJSObject: Js.Types.obj_val => Js.t('a) = "%identity";

let fromJs = jsSubscriberResult => {
  switch (Js.Types.classify(jsSubscriberResult)) {
  | JSObject(obj) =>
    Js.Array.isArray(obj) ?
      Some(obj |> absObjectToArray) : Some([|obj |> absObjectToJSObject|])
  | JSNull
  | JSUndefined => None
  | _ =>
    Js.Exn.raiseTypeError(
      "Subscriber result must be undefined, object or array",
    )
  };
};