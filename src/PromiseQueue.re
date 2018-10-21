module IdleListeners =
  Registrar.Make({
    type t = (. unit) => unit;
  });
type registerIdleCallbackFn = IdleListeners.listenerFn;

let create = initialValue => {
  let queuePromise = ref(Repromise.resolved(initialValue));
  let (registerIdleCallback, getIdleListeners) = IdleListeners.create();

  let addToQueue = cb => {
    let currentPromise = ref(Repromise.resolved(initialValue));

    queuePromise := cb(queuePromise^);

    queuePromise^
    |> Repromise.wait(_ =>
         if (currentPromise^ === queuePromise^) {
           getIdleListeners() |> List.iter(cb => cb(.));
         }
       );

    currentPromise := queuePromise^;
  };

  (addToQueue, registerIdleCallback);
};