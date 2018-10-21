type effectResult;
type runResult =
  | SyncResult(Result.t(effectResult, Js.Exn.t))
  | AsyncResult(Repromise.t(Result.t(effectResult, Js.Promise.error)));
type resultActionCreator =
  (bool, Belt.Result.t(effectResult, Js.Exn.t)) => Store.action;
[@bs.deriving abstract]
type jsEffect = {
  resultActionCreator: option(resultActionCreator),
  isQueued: bool,
};
[@bs.send] external run: jsEffect => effectResult = "run";

[@bs.send]
external resultActionCreatorOk:
  (jsEffect, [@bs.as {json|false|json}] _, effectResult) => Store.action =
  "resultActionCreator";
[@bs.send]
external resultActionCreatorError:
  (jsEffect, [@bs.as {json|true|json}] _, Js.Exn.t) => Store.action =
  "resultActionCreator";

external effectObjectToJsEffect: Js.t('a) => jsEffect = "%identity";

type effect =
  | Immediate(jsEffect)
  | Queued(jsEffect);

let getJsEffect = effect =>
  switch (effect) {
  | Queued(jsEffect) => jsEffect
  | Immediate(jsEffect) => jsEffect
  };

let createResultAction = (result, effect) => {
  let jsEffect = getJsEffect(effect);
  switch (result) {
  | Belt.Result.Ok(v) => jsEffect->resultActionCreatorOk(v)
  | Belt.Result.Error(ex) => jsEffect->resultActionCreatorError(ex)
  };
};

let getResultActionCreator = effect =>
  switch (getJsEffect(effect)->resultActionCreatorGet) {
  | Some(_) => Some(createResultAction)
  | None => None
  };

let createAsyncRunResultPromise = effectResultPromise => {
  Repromise.Rejectable.fromJsPromise(effectResultPromise)
  |> Repromise.Rejectable.map(res => Result.Ok(res))
  |> Repromise.Rejectable.catch(err => Repromise.resolved(Result.Error(err)));
};

let run = effect => {
  let result = Result.try_(() => effect |> getJsEffect |> run);
  switch (result) {
  | Result.Ok(runResultValueOrPromise) =>
    switch (Helpers.classifyValueOrPromise(runResultValueOrPromise)) {
    | Helpers.Promise(p) => AsyncResult(createAsyncRunResultPromise(p))
    | Helpers.Value(v) => SyncResult(Result.Ok(v))
    }
  | Result.Error(error) => SyncResult(Result.Error(error))
  };
};

let runResultToPromise = runResult =>
  switch (runResult) {
  | SyncResult(effectResult) =>
    switch (effectResult) {
    | Result.Ok(okResult) => Repromise.resolved(Result.Ok(okResult))
    | Result.Error(error) =>
      Repromise.resolved(Result.Error(Helpers.exnToPromiseError(error)))
    }
  | AsyncResult(effectResultPromise) => effectResultPromise
  };

let validateEffect = effect => {
  switch (Js.Types.classify(effect)) {
  | JSObject(_) =>
    let runType = Js.Types.classify(effect##run);
    let isQueuedType = Js.Types.classify(effect##isQueued);
    let resultActionCreatorType =
      Js.Types.classify(effect##resultActionCreator);

    switch (runType, isQueuedType, resultActionCreatorType) {
    | (JSFunction(_), JSTrue | JSFalse, JSNull | JSUndefined | JSFunction(_)) =>
      effect |> ignore
    | _ => Js.Exn.raiseTypeError("Invalid effect object")
    };
  | _ => Js.Exn.raiseTypeError("Invalid effect object")
  };

  effectObjectToJsEffect(effect);
};

let isImmediateEffect = effect =>
  switch (effect) {
  | Immediate(_) => true
  | Queued(_) => false
  };

let isQueuedEffect = effect => !isImmediateEffect(effect);

let toVariant = effect =>
  effect->isQueuedGet ? Queued(effect) : Immediate(effect);

let subscriberResultToEffects = subscriberResult => {
  switch (subscriberResult) {
  | Some(arr) =>
    arr |> Array.to_list |> List.map(validateEffect) |> List.map(toVariant)
  | None => []
  };
};