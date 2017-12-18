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
const { isPromise } = require('./utils/isPromise')
const { sequence, try_ } = require('./utils/either')

const isCmd = _ =>
  _ != null && typeof _.isQueued === 'boolean' && typeof _.run === 'function'
const isImmediateCommand = _ => isCmd(_) && !_.isQueued
const isQueuedCommand = _ => isCmd(_) && _.isQueued

const isCmdOrPromise = maybeCmdOrPromise =>
  isCmd(maybeCmdOrPromise) || isPromise(maybeCmdOrPromise)

const not = fn => x => !fn(x)

const createSerialEffectsMiddleware = extraArgument => {
  const subscribers = []
  let queuePromise = Promise.resolve()

  const middleware = store => next => action => {
    const runImmediateCommands = commands => {
      const immediateCommands = commands.filter(isImmediateCommand)
      const queuedCommands = flatten(
        immediateCommands.map(_ =>
          runImmediateCommands([].concat(_.run(store.dispatch)))
        )
      ).filter(isCmdOrPromise)
      return commands.filter(not(isImmediateCommand)).concat(queuedCommands)
    }

    const runQueuedCommands = commands => {
      const asyncCommands = commands.filter(isQueuedCommand)
      const promises = flatten(
        asyncCommands.map(_ => _.run(store.dispatch))
      ).filter(isCmdOrPromise)

      return promises
    }

    const executeQueuedCommands = (resolve, reject) => commands => {
      if (commands.length > 0) {
        return Promise.all(runQueuedCommands(commands))
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
      const queuedCommands = runImmediateCommands(commands)
      trigger(queuedCommands)
      return promise
    }

    const from = store.getState()
    const result = next(action)
    const to = store.getState()

    if (from !== to) {
      return sequence(
        subscribers
          .slice()
          .map(subscriber =>
            try_(() => subscriber({ from, to }, extraArgument))
          )
      ).fold(
        e => Promise.reject(e),
        commands => queueAndRunCommands(commands.filter(isCmd))
      )
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
