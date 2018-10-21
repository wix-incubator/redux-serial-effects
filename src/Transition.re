type selector = Store.state => Store.state;
type predicate = Store.state => bool;

[@bs.deriving abstract]
type t = {
  from: Store.state,
  _to: Store.state,
  hasChanged: selector => bool,
  hasChangedToMatch: (selector, predicate) => bool,
  hasChangedToTrue: selector => bool,
  hasChangedToFalse: selector => bool,
  hasChangedToNull: selector => bool,
  hasChangedToNotNull: selector => bool,
};

let equalsTrue = state =>
  switch (Js.Types.classify(state)) {
  | JSTrue => true
  | _ => false
  };

let equalsFalse = state =>
  switch (Js.Types.classify(state)) {
  | JSFalse => true
  | _ => false
  };

let equalsNull = state =>
  switch (Js.Types.classify(state)) {
  | JSNull => true
  | _ => false
  };

let negate = value => !value;

let create = (fromState, toState) => {
  let hasChanged = selector => selector(fromState) !== selector(toState);
  let hasChangedToMatch = (selector, predicate) =>
    hasChanged(selector) && predicate(selector(toState));
  let hasChangedToTrue = selector => hasChangedToMatch(selector, equalsTrue);
  let hasChangedToFalse = selector =>
    hasChangedToMatch(selector, equalsFalse);
  let hasChangedToNull = selector => hasChangedToMatch(selector, equalsNull);
  let hasChangedToNotNull = selector =>
    hasChangedToMatch(selector, state => equalsNull(state) |> negate);

  t(
    ~from=fromState,
    ~_to=toState,
    ~hasChanged,
    ~hasChangedToMatch,
    ~hasChangedToTrue,
    ~hasChangedToFalse,
    ~hasChangedToNull,
    ~hasChangedToNotNull,
  );
};