[@bs.module] external throwJSException: Js.Exn.t => 'a = "./throwJSException";

type nextResult('a) = Js.Undefined.t('a);
type next('a) = Store.action => nextResult('a);
type middlewareResult('a) =
  Repromise.Rejectable.t(nextResult('a), Js.Promise.error);
type middleware('a) =
  (. Store.t) => (. next('a)) => (. Store.action) => middlewareResult('a);

[@bs.deriving abstract]
type t('a) = {
  middleware: middleware('a),
  subscribe: Subscribers.subscribeFn,
  onIdle: PromiseQueue.registerIdleCallbackFn,
};

Repromise.onUnhandledException :=
  (
    exn => {
      throwJSException(Obj.magic(exn)) |> Obj.magic;
    }
  );

let createMiddleware = () => {
  let (middleware, subscribe, onIdle) = Middleware.create();

  let jsMiddleware =
    (. store) =>
      (. next) =>
        (. action) =>
          switch (middleware(store, next, action)) {
          | Middleware.EffectsSuccess(promise) =>
            promise
            |> Repromise.Rejectable.relax
            |> Repromise.Rejectable.andThen(result =>
                 switch (result) {
                 | Result.Ok(_) => Repromise.Rejectable.resolved(Js.undefined)
                 | Result.Error(e) => Repromise.Rejectable.rejected(e)
                 }
               )
          | Middleware.EffectsError(err) => throwJSException(err)
          | Middleware.NoChange(nextResult) =>
            Repromise.Rejectable.resolved(nextResult)
          };

  t(~middleware=jsMiddleware, ~subscribe, ~onIdle);
};