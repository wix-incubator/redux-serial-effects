type t;
type state;
type action;

[@bs.send] external getState: t => state = "";
[@bs.send]
external dispatch:
  (t, action) => Repromise.Rejectable.t(unit, Js.Promise.error) =
  "";

let dispatch = (t, action) =>
  dispatch(t, action)
  |> Repromise.Rejectable.map(_ => Result.Ok())
  |> Repromise.Rejectable.catch(error =>
       Repromise.resolved(Result.Error(error))
     );