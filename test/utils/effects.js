const queuedDelayedValue = (delay, value, resultActionType) => ({
  run: () =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve(value)
      }, delay)
    }),
  isQueued: true,
  resultActionType
})

const queuedDelayedReject = (delay, error, resultActionType) => ({
  run: () =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error(error))
      }, delay)
    }),
  isQueued: true,
  resultActionType
})

const queuedReject = (error, resultActionType) => ({
  run: () => Promise.reject(error),
  isQueued: true,
  resultActionType
})

const queuedThrow = (error, resultActionType) => ({
  run: () => {
    throw new Error(error)
  },
  isQueued: true,
  resultActionType
})

const immediateValue = (value, resultActionType) => ({
  run: () => value,
  isQueued: false,
  resultActionType
})

const immediateThrow = (error, resultActionType) => ({
  run: () => {
    throw new Error(error)
  },
  isQueued: false,
  resultActionType
})

const immediateReject = (error, resultActionType) => ({
  run: () => Promise.reject(error),
  isQueued: false,
  resultActionType
})

module.exports.queuedDelayedValue = queuedDelayedValue
module.exports.queuedDelayedReject = queuedDelayedReject
module.exports.queuedReject = queuedReject
module.exports.queuedThrow = queuedThrow
module.exports.immediateValue = immediateValue
module.exports.immediateThrow = immediateThrow
module.exports.immediateReject = immediateReject
