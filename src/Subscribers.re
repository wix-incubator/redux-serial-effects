module SubscribersRegistrar =
  Registrar.Make({
    type t = Transition.t => SubscriberResult.js_t;
  });
type subscribeFn = SubscribersRegistrar.listenerFn;

let create = () => {
  let (subscribe, getListeners) = SubscribersRegistrar.create();

  let callSubscriber = (subscriber, transition) => {
    subscriber(transition)
    |> SubscriberResult.fromJs
    |> Effect.subscriberResultToEffects;
  };

  let callSubscribers = transition =>
    getListeners()
    |> List.map(subscriber =>
         Result.try_(() => callSubscriber(subscriber, transition))
       );

  (subscribe, callSubscribers);
};