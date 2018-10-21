module type RegistrarListener = {type t;};

module Make = (RegistrarListener: RegistrarListener) => {
  type unregisterFn = unit => unit;
  type listenerFn = RegistrarListener.t => unregisterFn;

  module ListenersMap = Belt.Map.Int;

  let create = () => {
    let listeners = ref(ListenersMap.empty);
    let nextListenerId = ref(0);

    let register = fn => {
      nextListenerId := nextListenerId^ + 1;
      let currentId = nextListenerId^;
      listeners := ListenersMap.set(listeners^, currentId, fn);

      () => listeners := ListenersMap.remove(listeners^, currentId);
    };

    let getListeners = () =>
      listeners^ |> ListenersMap.toList |> List.map(snd);

    (register, getListeners);
  };
};