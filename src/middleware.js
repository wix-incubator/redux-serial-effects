'use strict'

// A redux extension to manage side-effects using expected vs. actual state.
//
// Consider a scenario where user activity triggeres I/O (e.g., API calls) that
// might fail. Such failures usually mean tha the local app state is in an
// inconsistent state relative to the server(s) state.
//
// The solution and strategy suggested by this module is to manage two copies of
// the state: actual state, and expected state. When possible, implementations
// should read the actual state from the environment (e.g., external services)
// and compare the updated expected state against it.
//
// This middleware provides the following services on top of what Redux's
// subscribers get:
// 1. Access to both the previous and current state
// 2. Maintains a queue of side-effects that run in order dispatched
// 3. Combining subscribers for composability

const { flatten } = require('./utils/flatten')

const isDispatchable = something =>
  something != null && typeof something === 'object'

const createSerialEffectsMiddleware = extraArgument => {
  const idleCallbacks = []
  const subscribers = []
  let queue = Promise.resolve()

  const middleware = store => next => action => {
    const from = store.getState()
    const result = next(action)
    const to = store.getState()

    if (from !== to) {
      const subs = subscribers.slice()
      return new Promise((resolve, reject) => {
        const q = (queue = queue
          .then(() =>
            Promise.all(
              subs.map(subscriber => subscriber({ from, to }, extraArgument))
            )
              .then(flatten)
              .then(actionsToDispatch => {
                Promise.all(
                  actionsToDispatch.filter(isDispatchable).map(store.dispatch)
                ).then(resolve, reject)
              }, reject)
          )
          .catch(() => {})
          .then(() => {
            if (q === queue) {
              idleCallbacks.slice().forEach(cb => cb())
            }
          }))
      })
    }

    return Promise.resolve(result)
  }

  const registrar = list => fn => {
    list.push(fn)
    return () => {
      const index = list.indexOf(fn)
      if (index >= 0) {
        list.splice(index, 1)
      }
    }
  }

  const subscribe = registrar(subscribers)
  const onIdle = registrar(idleCallbacks)

  return {
    middleware,
    subscribe,
    onIdle
  }
}

const serialEffectsMiddleware = createSerialEffectsMiddleware()
serialEffectsMiddleware.withExtraArgument = createSerialEffectsMiddleware

module.exports = serialEffectsMiddleware
