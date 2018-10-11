'use strict'

const { isPromise } = require('./utils/isPromise')
const { sequence, try_ } = require('./utils/either')
const { fromError, fromSuccess } = require('./action')
const createTransition = require('./utils/transition')
const { isCommand, isImmediateCommand, isQueuedCommand } = require('./commands')

const registrar = list => fn => {
  list.push(fn)
  return () => {
    const index = list.indexOf(fn)
    if (index >= 0) {
      list.splice(index, 1)
    }
  }
}

const createMiddleware = extraArgument => {
  const subscribers = []
  const executors = {}
  let queuePromise = Promise.resolve()

  const middleware = store => next => action => {
    const executeCommand = cmd => {
      const result = try_(() => executors[cmd.type](cmd.command))
      return result.fold(
        error => {
          const downstreamPromise = cmd.actionType
            ? store.dispatch(fromError(cmd.actionType, error))
            : Promise.resolve()
          return [result, downstreamPromise]
        },
        value => {
          if (isPromise(value)) {
            const downstreamPromise = value.then(
              resolvedValue => {
                return cmd.actionType
                  ? store.dispatch(fromSuccess(cmd.actionType, resolvedValue))
                  : Promise.resolve()
              },
              error => {
                if (cmd.actionType) {
                  store
                    .dispatch(fromError(cmd.actionType, error))
                    .catch(() => {})
                }
                throw error
              }
            )
            return [result, downstreamPromise]
          } else {
            const downstreamPromise = cmd.actionType
              ? store.dispatch(fromSuccess(cmd.actionType, value))
              : Promise.resolve()
            return [result, downstreamPromise]
          }
        }
      )
    }

    const runImmediateCommands = commands => {
      const immediateCommands = commands.filter(isImmediateCommand)
      const promiseTuples = immediateCommands.map(executeCommand)
      promiseTuples.map(tuple => tuple[0]).map(result =>
        result.fold(error => {
          throw error
        }, value => value)
      )
      promiseTuples
        .map(tuple => tuple[1])
        .map(downstreamPromise => downstreamPromise.catch(() => {}))
      return commands.filter(isQueuedCommand)
    }

    const executeQueuedCommands = (resolve, reject) => commands => {
      if (commands.length > 0) {
        const promiseTuples = commands
          .filter(isQueuedCommand)
          .map(executeCommand)
        Promise.all(promiseTuples.map(tuple => tuple[1])).then(
          () => resolve(),
          reject
        )

        return Promise.all(
          promiseTuples.map(tuple => tuple[0]).map(result =>
            result.fold(error => {
              return Promise.reject(error)
            }, value => value)
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
        queuePromise = queuePromise
          .then(() => gate)
          .then(executeQueuedCommands(resolve, reject), reject)
          .catch(reject)
      })

      return { promise, trigger }
    }

    const queueAndRunCommands = commands => {
      const { promise, trigger } = scheduleExecution()
      return try_(() => {
        return runImmediateCommands(commands)
      }).fold(
        e => {
          if (trigger) {
            trigger([])
          }
          throw e
        },
        commands => {
          if (trigger) {
            trigger(commands)
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
      const issuedCommands = sequence(
        subscribers
          .slice()
          .map(subscriber =>
            try_(() => subscriber(transition, extraArgument) || [])
          )
      )

      return issuedCommands.fold(
        e => {
          throw e
        },
        commands => {
          return queueAndRunCommands(commands.filter(isCommand))
        }
      )
    }

    return Promise.resolve(result)
  }

  const subscribe = registrar(subscribers)

  const registerExecutors = (...args) => {
    args.forEach(executor => (executors[executor.type] = executor.execute))
  }

  return {
    middleware,
    registerExecutors,
    subscribe
  }
}

module.exports = createMiddleware
