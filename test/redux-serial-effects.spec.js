'use strict'

const tape = require('tape-catch')
const _test = require('tape-promise').default
const test = _test(tape)

const { createStore, applyMiddleware, combineReducers } = require('redux')
const {
  combineSubscribers,
  serialEffectsMiddleware,
  createCallableCmd,
  createDispatchCmd
} = require('../src/index')

const SET_COUNTER = 'SET_COUNTER'
const ADD_UNDO = 'ADD_UNDO'

const unhandledRejectionListener = reason => {
  console.warn('Unhandled rejection:', reason) // eslint-disable-line no-console
}
process.on('unhandledRejection', unhandledRejectionListener)

test('should change the state synchronously', function(t) {
  t.plan(1)

  const initialState = {
    counter: 0
  }
  const reducer = (state, action) => {
    switch (action.type) {
      case SET_COUNTER: {
        return Object.assign({}, state, { counter: action.value })
      }
      default:
        return state
    }
  }

  const { middleware } = serialEffectsMiddleware.withExtraArgument()
  const store = createStore(reducer, initialState, applyMiddleware(middleware))

  store.dispatch({ type: SET_COUNTER, value: 1 })
  store.dispatch({ type: SET_COUNTER, value: 2 })

  t.deepEqual(
    store.getState(),
    { counter: 2 },
    'state was updated synchronously'
  )
})

test('should receive the previous state and the new state', function(t) {
  t.plan(1)

  const initialState = {
    counter: 0
  }
  const reducer = (state, action) => {
    switch (action.type) {
      case SET_COUNTER: {
        return Object.assign({}, state, { counter: action.value })
      }
      default:
        return state
    }
  }

  const subscriber = states => {
    t.deepEqual(
      states,
      { from: initialState, to: { counter: 1 } },
      'both state objects passed correctly'
    )
  }

  const { middleware, subscribe } = serialEffectsMiddleware.withExtraArgument()
  subscribe(subscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))

  return store.dispatch({ type: SET_COUNTER, value: 1 })
})

test('should receive the extra argument given when creating the middleware', function(
  t
) {
  t.plan(1)

  const initialState = {
    counter: 0
  }
  const reducer = (state, action) => {
    switch (action.type) {
      case SET_COUNTER: {
        return Object.assign({}, state, { counter: action.value })
      }
      default:
        return state
    }
  }

  const extra = Symbol('extra')

  const subscriber = ({ from, to }, extraArgument) => {
    t.equal(extra, extraArgument, 'correct extraArgument passed')
  }

  const { middleware, subscribe } = serialEffectsMiddleware.withExtraArgument(
    extra
  )
  subscribe(subscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))

  return store.dispatch({ type: SET_COUNTER, value: 1 })
})

test('should compose subscribers', function(t) {
  t.plan(1)

  const initialState = {
    counterOne: { value: 0 },
    counterTwo: { value: 1 },
    counterThree: { value: 2 }
  }
  const reducer = index => (state = { value: index }, action) => {
    switch (action.type) {
      case SET_COUNTER: {
        return action.value !== state.value
          ? Object.assign({}, state, { value: action.value })
          : state
      }
      default:
        return state
    }
  }

  const triggeredSubscribers = []
  const subscriber = index => ({ from, to }) => {
    triggeredSubscribers.push(index)
  }

  const { middleware, subscribe } = serialEffectsMiddleware.withExtraArgument()
  subscribe(
    combineSubscribers({
      counterOne: subscriber(0),
      counterTwo: subscriber(1),
      counterThree: subscriber(2)
    })
  )
  const store = createStore(
    combineReducers({
      counterOne: reducer(0),
      counterTwo: reducer(1),
      counterThree: reducer(2)
    }),
    initialState,
    applyMiddleware(middleware)
  )

  return store.dispatch({ type: SET_COUNTER, value: 1 }).then(() => {
    t.equal(
      triggeredSubscribers.length,
      2,
      'the correct subscribers were called'
    )
    t.end()
  })
})

test('should not call unsubscribed subscribers', function(t) {
  t.plan(1)

  const initialState = {
    counter: 0
  }
  const reducer = (state, action) => {
    switch (action.type) {
      case SET_COUNTER: {
        return Object.assign({}, state, { counter: action.value })
      }
      default:
        return state
    }
  }

  let subscriberCalled = false
  const subscriber = ({ from, to }) => {
    subscriberCalled = true
  }

  const { middleware, subscribe } = serialEffectsMiddleware.withExtraArgument()
  subscribe(subscriber)()
  const store = createStore(reducer, initialState, applyMiddleware(middleware))

  return store.dispatch({ type: SET_COUNTER, value: 1 }).then(() => {
    t.false(subscriberCalled, 'subscriber was not called')
  })
})

test('should not break when unsubscribing an already unsubscribed subscriber', function(
  t
) {
  t.plan(1)

  const initialState = {
    counter: 0
  }
  const reducer = (state, action) => {
    switch (action.type) {
      case SET_COUNTER: {
        return Object.assign({}, state, { counter: action.value })
      }
      default:
        return state
    }
  }

  const unsubscriber = () => t.fail('unsubscribed subscriber called')

  let subscriberCalled = false
  const subscriber = ({ from, to }) => {
    subscriberCalled = true
  }

  const { middleware, subscribe } = serialEffectsMiddleware.withExtraArgument()
  subscribe(subscriber)
  const unsubscribeUnsubscriber = subscribe(unsubscriber)

  const store = createStore(reducer, initialState, applyMiddleware(middleware))

  unsubscribeUnsubscriber()
  unsubscribeUnsubscriber()

  return store.dispatch({ type: SET_COUNTER, value: 1 }).then(() => {
    t.true(subscriberCalled, 'registered subscriber called')
  })
})

test('should not call subscribers when the dispatched action does not change the state', function(
  t
) {
  t.plan(1)

  const initialState = {
    counter: 0
  }
  const reducer = (state, action) => {
    switch (action.type) {
      case SET_COUNTER: {
        return Object.assign({}, state, { counter: action.value })
      }
      default:
        return state
    }
  }

  let subscriberCalled = false
  const subscriber = ({ from, to }) => {
    subscriberCalled = true
  }

  const { middleware, subscribe } = serialEffectsMiddleware.withExtraArgument()
  subscribe(subscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))

  return store.dispatch({ type: ADD_UNDO, undo: [] }).then(() => {
    t.false(subscriberCalled, 'subscriber was not called')
  })
})

test('should handle exceptions in subscriber code', function(t) {
  t.plan(1)

  const initialState = {
    counter: 0
  }
  const reducer = (state, action) => {
    switch (action.type) {
      case SET_COUNTER: {
        return Object.assign({}, state, { counter: action.value })
      }
      default:
        return state
    }
  }

  let shouldThrow = true
  const subscriber = ({ from, to }) => {
    if (shouldThrow) {
      shouldThrow = false
      throw new Error('hardcoded exception')
    } else {
      t.equal(
        to.counter,
        2,
        'second action was handled correctly after the first call threw an exception'
      )
    }
  }

  const { middleware, subscribe } = serialEffectsMiddleware.withExtraArgument()
  subscribe(subscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))

  store.dispatch({ type: SET_COUNTER, value: 1 }).catch(() => {})
  store.dispatch({ type: SET_COUNTER, value: 2 })

  t.end()
})

test('should run async side-effects only after previous side-effect promises have resolved/rejected', function(
  t
) {
  t.plan(1)

  const initialState = {
    counter: 0
  }
  const reducer = (state, action) => {
    switch (action.type) {
      case SET_COUNTER: {
        return Object.assign({}, state, { counter: action.value })
      }
      default:
        return state
    }
  }

  let resolveFirstSideEffect = undefined
  let firstSideEffectsDone = false
  const firstSideEffectPromise = new Promise((resolve, reject) => {
    resolveFirstSideEffect = () => {
      firstSideEffectsDone = true
      resolve()
    }
  })

  const subscriber = ({ from, to }) => {
    if (to.counter === 1) {
      return createCallableCmd(true, () => firstSideEffectPromise, {
        name: 'first side-effect'
      })
    } else {
      return createCallableCmd(
        true,
        () => {
          t.true(
            firstSideEffectsDone,
            'second change subscribers called waited on first change side-effects'
          )
          t.end()
        },
        { name: 'second side-effect' }
      )
    }
  }

  const { middleware, subscribe } = serialEffectsMiddleware.withExtraArgument()
  subscribe(subscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))

  store.dispatch({ type: SET_COUNTER, value: 1 })
  const promise = store.dispatch({ type: SET_COUNTER, value: 2 })

  resolveFirstSideEffect()
  return promise.then(() => t.end())
})

test('should dispatch an action returned from a subscriber', function(t) {
  t.plan(1)

  const initialState = {
    counter: 0,
    mirroredCounter: 0
  }
  const MIRRORED_ACTION = 'mirrored_action'
  const reducer = (state, action) => {
    switch (action.type) {
      case SET_COUNTER: {
        return Object.assign({}, state, { counter: action.value })
      }
      case MIRRORED_ACTION: {
        return Object.assign({}, state, { mirroredCounter: action.value })
      }
      default:
        return state
    }
  }

  const subscriber = ({ from, to }) => {
    if (from.counter !== to.counter) {
      return createDispatchCmd({ type: MIRRORED_ACTION, value: to.counter })
    }
  }

  const { middleware, subscribe } = serialEffectsMiddleware.withExtraArgument()
  subscribe(subscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))

  return store.dispatch({ type: SET_COUNTER, value: 1 }).then(() => {
    t.equal(
      store.getState().mirroredCounter,
      store.getState().counter,
      'action dispatched'
    )
  })
})

test('should dispatch an action returned from side-effects chain', function(t) {
  t.plan(1)

  const initialState = {
    counter: 0,
    mirroredCounter: 0
  }
  const MIRRORED_ACTION = 'mirrored_action'
  const reducer = (state, action) => {
    switch (action.type) {
      case SET_COUNTER: {
        return Object.assign({}, state, { counter: action.value })
      }
      case MIRRORED_ACTION: {
        return Object.assign({}, state, { mirroredCounter: action.value })
      }
      default:
        return state
    }
  }

  const subscriber = ({ from, to }) => {
    if (from.counter !== to.counter) {
      return createCallableCmd(true, () =>
        Promise.resolve(
          createDispatchCmd({ type: MIRRORED_ACTION, value: to.counter })
        )
      )
    }
  }

  const { middleware, subscribe } = serialEffectsMiddleware.withExtraArgument()
  subscribe(subscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))

  return store.dispatch({ type: SET_COUNTER, value: 1 }).then(() => {
    t.equal(
      store.getState().mirroredCounter,
      store.getState().counter,
      'action dispatched'
    )
    t.end()
  })
})

test('should return a promise that resolves when side-effects of all subscribers are done', function(
  t
) {
  t.plan(2)

  const initialState = {
    counter: 0
  }
  const reducer = (state, action) => {
    switch (action.type) {
      case SET_COUNTER: {
        return Object.assign({}, state, { counter: action.value })
      }
      default:
        return state
    }
  }

  const firstSubscriber = ({ from, to }) => {
    if (from.counter !== to.counter) {
      return createCallableCmd(
        true,
        () =>
          new Promise((resolve, reject) => {
            setTimeout(() => {
              firstBatchDone = true
              resolve()
            }, 10)
          })
      )
    }
  }

  const secondSubscriber = ({ from, to }) => {
    if (from.counter !== to.counter) {
      return createCallableCmd(
        true,
        () =>
          new Promise((resolve, reject) => {
            setTimeout(() => {
              secondBatchDone = true
              resolve()
            }, 20)
          })
      )
    }
  }

  const { middleware, subscribe } = serialEffectsMiddleware.withExtraArgument()
  subscribe(firstSubscriber)
  subscribe(secondSubscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))

  let firstBatchDone = false
  let secondBatchDone = false

  const subscriberPromise = store.dispatch({
    type: SET_COUNTER,
    value: 1
  })

  return subscriberPromise.then(() => {
    t.true(firstBatchDone, 'first subscriber done')
    t.true(secondBatchDone, 'second subscriber done')
    t.end()
  })
})

test('should return a promise that resolves only after all related/subsequent commands are resolved', function(
  t
) {
  t.plan(1)

  const initialState = {
    counter: 0,
    undo: []
  }
  const reducer = (state, action) => {
    switch (action.type) {
      case SET_COUNTER: {
        return Object.assign({}, state, { counter: action.value })
      }
      case ADD_UNDO: {
        return Object.assign({}, state, { undo: action.undo })
      }
      default:
        return state
    }
  }

  const firstSubscriber = ({ from, to }) => {
    if (from.counter !== to.counter) {
      return createCallableCmd(
        true,
        () =>
          new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve(
                createDispatchCmd({
                  type: ADD_UNDO,
                  undo: to.undo.concat(from.counter)
                })
              )
            }, 20)
          })
      )
    }
  }

  const secondSubscriber = ({ from, to }) => {
    if (from.undo !== to.undo) {
      return createCallableCmd(
        true,
        () =>
          new Promise((resolve, reject) => {
            setTimeout(() => {
              sideEffectsDone = true
              resolve()
            }, 20)
          })
      )
    }
  }

  const { middleware, subscribe } = serialEffectsMiddleware.withExtraArgument()
  subscribe(firstSubscriber)
  subscribe(secondSubscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))

  let sideEffectsDone = false

  return store
    .dispatch({
      type: SET_COUNTER,
      value: 1
    })
    .then(() => {
      t.true(sideEffectsDone, 'promise resolved after side-effects completion')
      t.end()
    })
})

test('should return a promise that rejects if at least one async action rejected its promise', function(
  t
) {
  t.plan(1)

  const initialState = {
    root: {
      counter: 0
    }
  }
  const reducer = (state = initialState['root'], action) => {
    switch (action.type) {
      case SET_COUNTER: {
        return Object.assign({}, state, { counter: action.value })
      }
      default:
        return state
    }
  }

  const firstSubscriber = ({ from, to }) => {
    if (from.counter !== to.counter) {
      return createCallableCmd(
        true,
        () =>
          new Promise((resolve, reject) => {
            setTimeout(resolve, 20)
          }),
        { name: 'will resolve to nothing' }
      )
    }
  }

  const secondSubscriber = ({ from, to }) => {
    if (from.counter !== to.counter) {
      return createCallableCmd(
        true,
        () =>
          new Promise((resolve, reject) => {
            setTimeout(() => {
              reject(new Error('hardcoded rejection'))
            }, 20)
          }),
        { name: 'will reject' }
      )
    }
  }

  const { middleware, subscribe } = serialEffectsMiddleware.withExtraArgument()
  subscribe(combineSubscribers({ root: firstSubscriber }))
  subscribe(combineSubscribers({ root: secondSubscriber }))
  const store = createStore(
    combineReducers({ root: reducer }),
    initialState,
    applyMiddleware(middleware)
  )

  return store
    .dispatch({
      type: SET_COUNTER,
      value: 1
    })
    .catch(e => {
      t.equal(e.message, 'hardcoded rejection', 'promise rejected as expected')
    })
    .then(() => t.end())
})

test('should return a promise that rejects if any subsequent action triggered a side-effect rejection', function(
  t
) {
  t.plan(1)

  const initialState = {
    counter: 0,
    undo: []
  }
  const reducer = (state, action) => {
    switch (action.type) {
      case SET_COUNTER: {
        return Object.assign({}, state, { counter: action.value })
      }
      case ADD_UNDO: {
        return Object.assign({}, state, { undo: action.undo })
      }
      default:
        return state
    }
  }

  const firstSubscriber = ({ from, to }) => {
    if (from.counter !== to.counter) {
      return createCallableCmd(
        true,
        () =>
          new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve(
                createDispatchCmd({
                  type: ADD_UNDO,
                  undo: to.undo.concat(from.counter)
                })
              )
            }, 20)
          }),
        { name: 'will resolve to an action' }
      )
    }
  }

  const secondSubscriber = ({ from, to }) => {
    if (from.undo !== to.undo) {
      return createCallableCmd(
        true,
        () =>
          new Promise((resolve, reject) => {
            setTimeout(() => {
              reject(new Error('hardcoded rejection'))
            }, 20)
          }),
        { name: 'will reject' }
      )
    }
  }

  const { middleware, subscribe } = serialEffectsMiddleware.withExtraArgument()
  subscribe(firstSubscriber)
  subscribe(secondSubscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))

  return store
    .dispatch({
      type: SET_COUNTER,
      value: 1
    })
    .catch(e => {
      t.equal(e.message, 'hardcoded rejection', 'promise rejected as expected')
    })
    .then(() => t.end())
})

test('should return a promise that rejects if any subscriber throws an exception', function(
  t
) {
  t.plan(1)

  const initialState = {
    counter: 0
  }
  const reducer = (state, action) => {
    switch (action.type) {
      case SET_COUNTER: {
        return Object.assign({}, state, { counter: action.value })
      }
      default:
        return state
    }
  }

  const subscriber = ({ from, to }) => {
    throw new Error('hardcoded exception')
  }

  const { middleware, subscribe } = serialEffectsMiddleware.withExtraArgument()
  subscribe(subscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))

  return store.dispatch({ type: SET_COUNTER, value: 1 }).catch(e => {
    t.equal(e.message, 'hardcoded exception')
    t.end()
  })
})

test('should allow subscribers to return an array of commands', function(t) {
  t.plan(2)

  const initialState = {
    counter: 0,
    undo: []
  }
  const reducer = (state = initialState, action) => {
    switch (action.type) {
      case SET_COUNTER: {
        return Object.assign({}, state, { counter: action.value })
      }
      case ADD_UNDO: {
        return Object.assign({}, state, { undo: action.undo })
      }
      default:
        return state
    }
  }

  let sideEffectsDone = false
  const firstSubscriber = ({ from, to }) => {
    if (from.counter !== to.counter) {
      return [
        createDispatchCmd({
          type: ADD_UNDO,
          undo: to.undo.concat(from.counter)
        }),
        createCallableCmd(true, () => {
          return createCallableCmd(
            true,
            () =>
              new Promise((resolve, reject) => {
                setTimeout(() => {
                  sideEffectsDone = true
                  resolve()
                }, 20)
              })
          )
        })
      ]
    }
  }

  const { middleware, subscribe } = serialEffectsMiddleware.withExtraArgument()
  subscribe(firstSubscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))

  return store
    .dispatch({
      type: SET_COUNTER,
      value: 1
    })
    .then(() => {
      t.deepEqual(
        store.getState(),
        {
          counter: 1,
          undo: [0]
        },
        'action side-effect was dispatched and processed'
      )
      t.true(sideEffectsDone, 'async side-effect was executed and completed')
      t.end()
    })
})

test('should allow subscribers to return syncronous commands that resolve to an array of commands', function(
  t
) {
  t.plan(2)

  const initialState = {
    counter: 0,
    undo: []
  }
  const reducer = (state = initialState, action) => {
    switch (action.type) {
      case SET_COUNTER: {
        return Object.assign({}, state, { counter: action.value })
      }
      case ADD_UNDO: {
        return Object.assign({}, state, { undo: action.undo })
      }
      default:
        return state
    }
  }

  let sideEffectsDone = false
  const firstSubscriber = ({ from, to }) => {
    if (from.counter !== to.counter) {
      return createCallableCmd(false, () => {
        return [
          createDispatchCmd({
            type: ADD_UNDO,
            undo: to.undo.concat(from.counter)
          }),
          createCallableCmd(true, () => {
            return createCallableCmd(
              true,
              () =>
                new Promise((resolve, reject) => {
                  setTimeout(() => {
                    sideEffectsDone = true
                    resolve()
                  }, 20)
                })
            )
          })
        ]
      })
    }
  }

  const { middleware, subscribe } = serialEffectsMiddleware.withExtraArgument()
  subscribe(firstSubscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))

  return store
    .dispatch({
      type: SET_COUNTER,
      value: 1
    })
    .then(() => {
      t.deepEqual(
        store.getState(),
        {
          counter: 1,
          undo: [0]
        },
        'action side-effect was dispatched and processed'
      )
      t.true(sideEffectsDone, 'async side-effect was executed and completed')
      t.end()
    })
})

test('should allow subscribers to return asynchronous commands that resolve to an array of commands', function(
  t
) {
  t.plan(2)

  const initialState = {
    counter: 0,
    undo: []
  }
  const reducer = (state = initialState, action) => {
    switch (action.type) {
      case SET_COUNTER: {
        return Object.assign({}, state, { counter: action.value })
      }
      case ADD_UNDO: {
        return Object.assign({}, state, { undo: action.undo })
      }
      default:
        return state
    }
  }

  let sideEffectsDone = false
  const firstSubscriber = ({ from, to }) => {
    if (from.counter !== to.counter) {
      return createCallableCmd(true, () => {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            resolve([
              createDispatchCmd({
                type: ADD_UNDO,
                undo: to.undo.concat(from.counter)
              }),
              createCallableCmd(true, () => {
                return createCallableCmd(
                  true,
                  () =>
                    new Promise((resolve, reject) => {
                      setTimeout(() => {
                        sideEffectsDone = true
                        resolve()
                      }, 20)
                    })
                )
              })
            ])
          })
        }, 20)
      })
    }
  }

  const { middleware, subscribe } = serialEffectsMiddleware.withExtraArgument()
  subscribe(firstSubscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))

  return store
    .dispatch({
      type: SET_COUNTER,
      value: 1
    })
    .then(() => {
      t.deepEqual(
        store.getState(),
        {
          counter: 1,
          undo: [0]
        },
        'action side-effect was dispatched and processed'
      )
      t.true(sideEffectsDone, 'async side-effect was executed and completed')
      t.end()
    })
})
