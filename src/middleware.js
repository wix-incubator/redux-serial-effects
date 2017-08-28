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

const createSerialEffectsMiddleware = (extraArgument) => {
  let idleCallbacks = []
  let subscribers = []
  let queue = Promise.resolve()

  const middleware = store => next => action => {
    const from = store.getState()
    const result = next(action)
    const to = store.getState()

    if (from !== to) {
      const subs = subscribers.slice()
      const q = (queue = queue
        .then(() =>
          Promise.all(
            subs.map(subscriber =>
              subscriber({ from, to }, store.dispatch, extraArgument)
            )
          )
        )
        .catch(() => {})
        .then(() => {
          if (q === queue) {
            idleCallbacks.slice().forEach(cb => cb())
          }
        }))
    }

    return result
  }

  const registrar = (register, unregister, indexOf) => {
    return fn => {
      register(fn)

      let isRegistered = true
      return () => {
        if (!isRegistered) {
          return
        }

        isRegistered = false

        const index = indexOf(fn)
        unregister(index)
      }
    }
  }

  const subscribe = registrar(
    fn => (subscribers = subscribers.concat(fn)),
    index => (subscribers = subscribers.splice(index, 1)),
    fn => subscribers.indexOf(fn)
  )

  const onIdle = registrar(
    fn => (idleCallbacks = idleCallbacks.concat(fn)),
    index => (idleCallbacks = idleCallbacks.splice(index, 1)),
    fn => idleCallbacks.indexOf(fn)
  )

  return {
    middleware,
    subscribe,
    onIdle
  }
}

const serialEffectsMiddleware = createSerialEffectsMiddleware()
serialEffectsMiddleware.withExtraArgument = createSerialEffectsMiddleware

module.exports = serialEffectsMiddleware

// vim: set ts=2 sw=2 tw=80 et :