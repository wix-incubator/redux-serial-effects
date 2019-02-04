const { creatorWithType: actionCreatorWithType } = require('./resultAction')

const queuedDelayedValue = (delay, value, resultActionType) => ({
  run: () =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve(value)
      }, delay)
    }),
  isQueued: true,
  resultActionCreator: actionCreatorWithType(resultActionType)
})

const queuedDelayedReject = (delay, error, resultActionType) => ({
  run: () =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error(error))
      }, delay)
    }),
  isQueued: true,
  resultActionCreator: actionCreatorWithType(resultActionType)
})

const queuedReject = (error, resultActionType) => ({
  run: () => Promise.reject(error),
  isQueued: true,
  resultActionCreator: actionCreatorWithType(resultActionType)
})

const queuedThrow = (error, resultActionType) => ({
  run: () => {
    throw new Error(error)
  },
  isQueued: true,
  resultActionCreator: actionCreatorWithType(resultActionType)
})

const immediateValue = (value, resultActionType) => ({
  run: () => value,
  isQueued: false,
  resultActionCreator: actionCreatorWithType(resultActionType)
})

const immediateThrow = (error, resultActionType) => ({
  run: () => {
    throw new Error(error)
  },
  isQueued: false,
  resultActionCreator: actionCreatorWithType(resultActionType)
})

const immediateReject = (error, resultActionType) => ({
  run: () => Promise.reject(error),
  isQueued: false,
  resultActionCreator: actionCreatorWithType(resultActionType)
})

const queuedTriggeredValue = (value, resultActionType) => {
  let trigger = null
  const promise = new Promise((resolve, reject) => {
    trigger = () => resolve(value)
  })

  return {
    trigger,
    run: () => promise,
    isQueued: true,
    resultActionCreator: actionCreatorWithType(resultActionType)
  }
}

module.exports.queuedTriggeredValue = queuedTriggeredValue
module.exports.queuedDelayedValue = queuedDelayedValue
module.exports.queuedDelayedReject = queuedDelayedReject
module.exports.queuedReject = queuedReject
module.exports.queuedThrow = queuedThrow
module.exports.immediateValue = immediateValue
module.exports.immediateThrow = immediateThrow
module.exports.immediateReject = immediateReject
