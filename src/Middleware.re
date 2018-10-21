type middlewareResult('a, 'b, 'c) =
  | EffectsSuccess('a)
  | EffectsError('b)
  | NoChange('c);

let dispatchResultAction = (store, effect, result) => {
  switch (effect |> Effect.getResultActionCreator) {
  | Some(fn) => store->Store.dispatch(fn(result, effect))
  | None => Repromise.resolved(Result.Ok())
  };
};

let executeEffect = (store, effect) => {
  let runResult = Effect.run(effect);
  switch (runResult) {
  | Effect.SyncResult(result) =>
    let downstreamPromise = dispatchResultAction(store, effect, result);
    (runResult, downstreamPromise);
  | Effect.AsyncResult(effectResultPromise) =>
    let downstreamPromise =
      effectResultPromise
      |> Repromise.andThen(result =>
           switch (result) {
           | Result.Ok(effectResult) =>
             dispatchResultAction(store, effect, Result.Ok(effectResult))
           | Result.Error(error) =>
             dispatchResultAction(
               store,
               effect,
               Result.Error(Helpers.promiseErrorToExn(error)),
             )
             |> ignore;
             Repromise.resolved(Result.Error(error));
           }
         );

    (runResult, downstreamPromise);
  };
};

let getFirstRunResultErrorIfExists = runResults =>
  runResults
  |> List.map(runResult =>
       switch (runResult) {
       | Effect.SyncResult(Result.Error(ex)) => Result.Error(ex)
       | _ => Result.Ok()
       }
     )
  |> Result.getFirstError
  |> (
    maybeError => {
      switch (maybeError) {
      | None => Result.Ok()
      | Some(error) => Result.Error(error)
      };
    }
  );

let runImmediateEffects = (store, effects) =>
  effects
  |> List.map(executeEffect(store))
  |> List.map(fst)
  |> getFirstRunResultErrorIfExists;

let executeQueuedEffects = (store, resolve, effects) =>
  switch (effects) {
  | [] =>
    resolve(Result.Ok());
    Repromise.resolved();
  | _ =>
    let promiseTuples = effects |> List.map(executeEffect(store));

    promiseTuples
    |> List.map(snd)
    |> Repromise.all
    |> Repromise.map(resultList =>
         switch (Result.getFirstError(resultList)) {
         | None => resolve(Result.Ok())
         | Some(error) => resolve(Result.Error(error))
         }
       )
    |> Repromise.Rejectable.relax
    |> Repromise.Rejectable.catch(error => {
         resolve(Result.Error(error));
         Repromise.resolved();
       })
    |> ignore;

    promiseTuples
    |> List.map(fst)
    |> List.map(result => Effect.runResultToPromise(result))
    |> Repromise.all
    |> Repromise.map(resultList =>
         switch (Result.getFirstError(resultList)) {
         | None => ()
         | Some(error) => resolve(Result.Error(error))
         }
       );
  };

let scheduleExecution = (addToQueue, store) => {
  let (gate, trigger) = Repromise.make();
  let (schedulePromise, resolveSchedulePromise) = Repromise.make();

  addToQueue(queuePromise =>
    queuePromise
    |> Repromise.andThen(_ => gate)
    |> Repromise.andThen(executeQueuedEffects(store, resolveSchedulePromise))
  );

  (schedulePromise, trigger);
};

let queueAndRunEffects = (addToQueue, store, effects) => {
  let (promise, triggerExecution) = scheduleExecution(addToQueue, store);
  let immediateEffects = effects |> List.filter(Effect.isImmediateEffect);
  let queuedEffects = effects |> List.filter(Effect.isQueuedEffect);

  switch (runImmediateEffects(store, immediateEffects)) {
  | Result.Ok () =>
    triggerExecution(queuedEffects);
    Result.Ok(promise);
  | Result.Error(ex) =>
    triggerExecution([]);
    Result.Error(ex);
  };
};

let create = () => {
  let (subscribe, callSubscribers) = Subscribers.create();
  let (addToQueue, registerIdleCallback) = PromiseQueue.create();

  let middleware = (store, next, action) => {
    let fromState = store |> Store.getState;
    let result = next(action);
    let toState = store |> Store.getState;

    if (fromState !== toState) {
      let transition = Transition.create(fromState, toState);
      let issuedEffects = callSubscribers(transition) |> Result.sequence;

      switch (issuedEffects) {
      | Result.Ok(effects) =>
        effects
        |> queueAndRunEffects(addToQueue, store)
        |> (
          result =>
            switch (result) {
            | Result.Ok(promise) => EffectsSuccess(promise)
            | Result.Error(error) => EffectsError(error)
            }
        )
      | Result.Error(error) => EffectsError(error)
      };
    } else {
      NoChange(result);
    };
  };

  (middleware, subscribe, registerIdleCallback);
};