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
// 2. A queue of side-effects that run in order dispatched
// 3. Ability to combine subscribers for composability

const { flatten } = require('./utils/flatten')

const isPromise = maybePromise => typeof maybePromise.then === 'function'
const isSyncCommand = _ => !!_ && typeof _.isAsync === 'boolean' && !_.isAsync
const isAsyncCommand = _ => !!_ && typeof _.isAsync === 'boolean' && _.isAsync

const createSerialEffectsMiddleware = extraArgument => {
  const subscribers = []
  let queuePromise = Promise.resolve()

  const middleware = store => next => action => {
    const runSyncCommand = command => {
      const result =
        typeof command.action !== 'undefined'
          ? store.dispatch(command.action)
          : command.run()
      return runSyncCommands([].concat(result))
    }

    const runSyncCommands = commands => {
      const syncCommands = commands.filter(isSyncCommand)
      const newCommands = flatten(syncCommands.map(runSyncCommand)).filter(
        _ => !!_
      )
      return commands.filter(_ => !!_ && !isSyncCommand(_)).concat(newCommands)
    }

    const runAsyncCommands = commands => {
      const asyncCommands = commands.filter(isAsyncCommand)
      const promises = flatten(asyncCommands.map(_ => _.run())).filter(_ => !!_)

      return promises
    }

    const executeQueuedCommands = (resolve, reject) => commands => {
      if (commands.length > 0) {
        return Promise.all(runAsyncCommands(commands))
          .then(flatten)
          .then(additionalCommands => {
            Promise.all(commands.filter(isPromise))
              .then(() => queueAndRunCommands(additionalCommands))
              .then(resolve, reject)
          }, reject)
      } else {
        resolve()
        return Promise.resolve()
      }
    }

    const scheduleExecution = () => {
      let trigger = undefined
      const gate = new Promise(resolve => (trigger = resolve))
      const promise = new Promise((resolve, reject) => {
        queuePromise = queuePromise
          .then(() => gate)
          .then(executeQueuedCommands(resolve, reject), reject)
          .catch(() => {})
      })

      return { promise, trigger }
    }

    const queueAndRunCommands = commands => {
      const { promise, trigger } = scheduleExecution()
      const asyncCommands = runSyncCommands(commands)
      trigger(asyncCommands)
      return promise
    }

    const from = store.getState()
    const result = next(action)
    const to = store.getState()

    if (from !== to) {
      const commands = flatten(
        subscribers
          .slice()
          .map(subscriber => {
            try {
              return subscriber({ from, to }, extraArgument)
            } catch (e) {
              return Promise.reject(e)
            }
          })
          .filter(_ => !!_)
      )
      return queueAndRunCommands(commands)
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

  return {
    middleware,
    subscribe
  }
}

const serialEffectsMiddleware = createSerialEffectsMiddleware()
serialEffectsMiddleware.withExtraArgument = createSerialEffectsMiddleware

module.exports = serialEffectsMiddleware
