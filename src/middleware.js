'use strict'

const { isPromise } = require('./utils/isPromise')
const { sequence, try_ } = require('./utils/either')
const createTransition = require('./utils/transition')
const { isEffect, isImmediateEffect, isQueuedEffect } = require('./effects')

const registrar = list => fn => {
  list.push(fn)
  return () => {
    const index = list.indexOf(fn)
    if (index >= 0) {
      list.splice(index, 1)
    }
  }
}

const createMiddleware = () => {
  const subscribers = []
  const idleCallbacks = []
  let queuePromise = Promise.resolve()

  const middleware = store => next => action => {
    const executeEffect = effect => {
      const result = try_(() => effect.run())
      return result.fold(
        error => {
          const downstreamPromise = effect.resultActionCreator
            ? store.dispatch(effect.resultActionCreator(true, error))
            : Promise.resolve()
          return [result, downstreamPromise]
        },
        value => {
          if (isPromise(value)) {
            const downstreamPromise = value.then(
              resolvedValue => {
                return effect.resultActionCreator
                  ? store.dispatch(
                      effect.resultActionCreator(false, resolvedValue)
                    )
                  : Promise.resolve()
              },
              error => {
                if (effect.resultActionCreator) {
                  store
                    .dispatch(effect.resultActionCreator(true, error))
                    .catch(() => {})
                }
                throw error
              }
            )
            return [result, downstreamPromise]
          } else {
            const downstreamPromise = effect.resultActionCreator
              ? store.dispatch(effect.resultActionCreator(false, value))
              : Promise.resolve()
            return [result, downstreamPromise]
          }
        }
      )
    }

    const runImmediateEffects = effects => {
      const immediateEffects = effects.filter(isImmediateEffect)
      const promiseTuples = immediateEffects.map(executeEffect)
      promiseTuples.map(tuple => tuple[0]).map(result =>
        result.fold(
          error => {
            throw error
          },
          value => value
        )
      )
      promiseTuples
        .map(tuple => tuple[1])
        .map(downstreamPromise => downstreamPromise.catch(() => {}))
      return effects.filter(isQueuedEffect)
    }

    const executeQueuedEffects = (resolve, reject) => effects => {
      if (effects.length > 0) {
        const promiseTuples = effects.filter(isQueuedEffect).map(executeEffect)
        Promise.all(promiseTuples.map(tuple => tuple[1])).then(
          () => resolve(),
          reject
        )

        return Promise.all(
          promiseTuples.map(tuple => tuple[0]).map(result =>
            result.fold(
              error => {
                return Promise.reject(error)
              },
              value => value
            )
          )
        ).catch(reject)
      } else {
        resolve()
        return Promise.resolve()
      }
    }

    const scheduleExecution = () => {
      let trigger = undefined
      const gate = new Promise(resolve => (trigger = resolve))
      const promise = new Promise((resolve, reject) => {
        const p = (queuePromise = queuePromise
          .then(() => gate)
          .then(executeQueuedEffects(resolve, reject), reject)
          .catch(reject)
          .then(() => {
            if (p === queuePromise) {
              idleCallbacks.slice().forEach(cb => cb())
            }
          }))
      })

      return { promise, trigger }
    }

    const queueAndRunEffects = effects => {
      const { promise, trigger } = scheduleExecution()
      return try_(() => {
        return runImmediateEffects(effects)
      }).fold(
        e => {
          if (trigger) {
            trigger([])
          }
          throw e
        },
        effects => {
          if (trigger) {
            trigger(effects)
          }
          return promise
        }
      )
    }

    const from = store.getState()
    const result = next(action)
    const to = store.getState()

    if (from !== to) {
      const transition = createTransition(from, to)
      const issuedEffects = sequence(
        subscribers
          .slice()
          .map(subscriber => try_(() => subscriber(transition) || []))
      )

      return issuedEffects.fold(
        e => {
          throw e
        },
        effects => {
          return queueAndRunEffects(effects.filter(isEffect))
        }
      )
    }

    return Promise.resolve(result)
  }

  const subscribe = registrar(subscribers)
  const onIdle = registrar(idleCallbacks)

  return {
    middleware,
    subscribe,
    onIdle
  }
}

module.exports = createMiddleware
