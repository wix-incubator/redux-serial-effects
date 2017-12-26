'use strict'

const tape = require('tape-catch')
const _test = require('tape-promise').default
const test = _test(tape)

const { createStore, applyMiddleware, combineReducers } = require('redux')
const {
  combineSubscribers,
  serialEffectsMiddleware,
  dispatchCmd,
  dispatchProvider,
  immediateThunkCmd,
  queuedThunkCmd,
  thunkProvider
} = require('../src/index')
const createCmd = require('../src/commands/base')

const SET_COUNTER = 'SET_COUNTER'
const ADD_UNDO = 'ADD_UNDO'

process.on('unhandledRejection', reason => {
  console.warn('Unhandled rejection:', reason) // eslint-disable-line no-console
})

process.on('uncaughtException', reason => {
  console.warn('Uncaught exception:', reason) // eslint-disable-line no-console
})

const dispatchUndoCmd = undo => dispatchCmd({ type: ADD_UNDO, undo })

const DELAYED_UNDO_TYPE = 'DELAYED_UNDO'
const delayedUndoProvider = {
  type: DELAYED_UNDO_TYPE,
  runner: cmd => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve(dispatchUndoCmd(cmd.undo))
      }, cmd.delay)
    })
  }
}

const delayedUndoCmd = (delay, undo) =>
  createCmd(DELAYED_UNDO_TYPE, true, {
    delay,
    undo
  })

const delayedThunk = (delay, fn) =>
  queuedThunkCmd(extraArgument => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(fn(extraArgument))
        } catch (e) {
          reject(e)
        }
      }, delay)
    })
  })

const delayedRejection = (delay, reason) =>
  queuedThunkCmd(extraArgument => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error(reason))
      }, delay)
    })
  })

const delayedValue = (delay, value) => delayedThunk(delay, () => value)

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

  try {
    store.dispatch({ type: SET_COUNTER, value: 1 })
  } catch (e) {}

  return store
    .dispatch({ type: SET_COUNTER, value: 2 })
    .then(() => t.end())
    .catch(t.fail)
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
      return immediateThunkCmd(() => firstSideEffectPromise)
    } else {
      return queuedThunkCmd(() => {
        t.true(
          firstSideEffectsDone,
          'second change subscribers called waited on first change side-effects'
        )
        t.end()
      })
    }
  }

  const {
    middleware,
    subscribe,
    registerProviders
  } = serialEffectsMiddleware.withExtraArgument()
  subscribe(subscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))
  registerProviders(thunkProvider())

  store.dispatch({ type: SET_COUNTER, value: 1 })
  const promise = store.dispatch({ type: SET_COUNTER, value: 2 })

  resolveFirstSideEffect()
  return promise
})

test('should synchronously dispatch an action returned from a subscriber', function(
  t
) {
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
      return dispatchCmd({ type: MIRRORED_ACTION, value: to.counter })
    }
  }

  const {
    middleware,
    subscribe,
    registerProviders
  } = serialEffectsMiddleware.withExtraArgument()
  subscribe(subscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))
  registerProviders(dispatchProvider(store.dispatch))

  const dispatchPromise = store.dispatch({ type: SET_COUNTER, value: 1 })

  t.equal(
    store.getState().mirroredCounter,
    store.getState().counter,
    'synchronous action dispatched'
  )

  return dispatchPromise
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
      return queuedThunkCmd(() =>
        Promise.resolve(
          dispatchCmd({ type: MIRRORED_ACTION, value: to.counter })
        )
      )
    }
  }

  const {
    middleware,
    subscribe,
    registerProviders
  } = serialEffectsMiddleware.withExtraArgument()
  subscribe(subscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))
  registerProviders(dispatchProvider(store.dispatch), thunkProvider())

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
      return delayedThunk(10, () => {
        firstBatchDone = true
      })
    }
  }

  const secondSubscriber = ({ from, to }) => {
    if (from.counter !== to.counter) {
      return delayedThunk(20, () => {
        secondBatchDone = true
      })
    }
  }

  const {
    middleware,
    subscribe,
    registerProviders
  } = serialEffectsMiddleware.withExtraArgument()
  subscribe(firstSubscriber)
  subscribe(secondSubscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))
  registerProviders(thunkProvider())

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
  t.plan(2)

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
        return Object.assign({}, state, {
          undo: state.undo.concat(action.undo)
        })
      }
      default:
        return state
    }
  }

  const firstSubscriber = ({ from, to }) => {
    if (from.counter !== to.counter) {
      return delayedUndoCmd(20, from.counter)
    }
  }

  const secondSubscriber = ({ from, to }) => {
    if (from.undo !== to.undo) {
      return delayedThunk(20, () => {
        sideEffectsDone = true
      })
    }
  }

  const {
    middleware,
    subscribe,
    registerProviders
  } = serialEffectsMiddleware.withExtraArgument()
  subscribe(firstSubscriber)
  subscribe(secondSubscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))
  registerProviders(
    dispatchProvider(store.dispatch),
    delayedUndoProvider,
    thunkProvider()
  )

  let sideEffectsDone = false

  return store
    .dispatch({
      type: SET_COUNTER,
      value: 1
    })
    .then(() => {
      t.true(sideEffectsDone, 'promise resolved after side-effects completion')
      t.deepEqual(
        store.getState(),
        { counter: 1, undo: [0] },
        'action dispatched'
      )
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
      return delayedThunk(20, () => {})
    }
  }

  const secondSubscriber = ({ from, to }) => {
    if (from.counter !== to.counter) {
      return delayedRejection(20, 'hardcoded rejection')
    }
  }

  const {
    middleware,
    subscribe,
    registerProviders
  } = serialEffectsMiddleware.withExtraArgument()
  subscribe(combineSubscribers({ root: firstSubscriber }))
  subscribe(combineSubscribers({ root: secondSubscriber }))
  const store = createStore(
    combineReducers({ root: reducer }),
    initialState,
    applyMiddleware(middleware)
  )
  registerProviders(thunkProvider())

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
  t.plan(2)

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
        return Object.assign({}, state, {
          undo: state.undo.concat(action.undo)
        })
      }
      default:
        return state
    }
  }

  const firstSubscriber = ({ from, to }) => {
    if (from.counter !== to.counter) {
      return delayedUndoCmd(20, from.counter)
    }
  }

  const secondSubscriber = ({ from, to }) => {
    if (from.undo !== to.undo) {
      return delayedRejection(20, 'hardcoded rejection')
    }
  }

  const {
    middleware,
    subscribe,
    registerProviders
  } = serialEffectsMiddleware.withExtraArgument()
  subscribe(firstSubscriber)
  subscribe(secondSubscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))
  registerProviders(
    dispatchProvider(store.dispatch),
    delayedUndoProvider,
    thunkProvider()
  )

  return store
    .dispatch({
      type: SET_COUNTER,
      value: 1
    })
    .catch(e => {
      t.equal(e.message, 'hardcoded rejection', 'promise rejected as expected')
      t.deepEqual(
        store.getState(),
        {
          counter: 1,
          undo: [0]
        },
        'action side-effect was dispatched and processed'
      )
    })
    .then(() => t.end())
})

test('should throw an exception if any subscriber throws an exception', function(
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

  try {
    store.dispatch({ type: SET_COUNTER, value: 1 })
    t.fail('exception not thrown')
  } catch (e) {
    t.equal(e.message, 'hardcoded exception')
  }
  t.end()
})

test('should throw an exception if any immediate side-effect throws an exception', function(
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

  const errorText = 'hardcoded exception'
  const subscriber = ({ from, to }) => {
    return immediateThunkCmd(undo => {
      throw new Error(errorText)
    })
  }

  const {
    middleware,
    subscribe,
    registerProviders
  } = serialEffectsMiddleware.withExtraArgument()
  subscribe(subscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))
  registerProviders(dispatchProvider(store.dispatch), thunkProvider())

  try {
    store.dispatch({ type: SET_COUNTER, value: 1 })
    t.fail('exception not thrown')
  } catch (e) {
    t.equal(e.message, 'hardcoded exception')
  }
  t.end()
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
        return Object.assign({}, state, {
          undo: state.undo.concat(action.undo)
        })
      }
      default:
        return state
    }
  }

  let sideEffectsDone = false
  const subscriber = ({ from, to }) => {
    if (from.counter !== to.counter) {
      return [
        dispatchUndoCmd(from.counter),
        delayedThunk(20, () => {
          sideEffectsDone = true
        })
      ]
    }
  }

  const {
    middleware,
    subscribe,
    registerProviders
  } = serialEffectsMiddleware.withExtraArgument()
  subscribe(subscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))
  registerProviders(dispatchProvider(store.dispatch), thunkProvider())

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

test('should allow subscribers to return syncronous commands that return an array of commands', function(
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
        return Object.assign({}, state, {
          undo: state.undo.concat(action.undo)
        })
      }
      default:
        return state
    }
  }

  let sideEffectsDone = false
  const subscriber = ({ from, to }) => {
    if (from.counter !== to.counter) {
      return immediateThunkCmd(undo => {
        return [
          dispatchUndoCmd(from.counter),
          delayedThunk(20, () => {
            sideEffectsDone = true
          })
        ]
      })
    }
  }

  const {
    middleware,
    subscribe,
    registerProviders
  } = serialEffectsMiddleware.withExtraArgument()
  subscribe(subscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))
  registerProviders(dispatchProvider(store.dispatch), thunkProvider())

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
        return Object.assign({}, state, {
          undo: state.undo.concat(action.undo)
        })
      }
      default:
        return state
    }
  }

  let sideEffectsDone = false
  const subscriber = ({ from, to }) => {
    if (from.counter !== to.counter) {
      return queuedThunkCmd(undo => {
        return delayedValue(20, [
          dispatchUndoCmd(from.counter),
          delayedThunk(20, () => {
            sideEffectsDone = true
          })
        ])
      })
    }
  }

  const {
    middleware,
    subscribe,
    registerProviders
  } = serialEffectsMiddleware.withExtraArgument()
  subscribe(subscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))
  registerProviders(dispatchProvider(store.dispatch), thunkProvider())

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

test('should handle exceptions in providers code', function(t) {
  t.plan(1)

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
        return Object.assign({}, state, {
          undo: state.undo.concat(action.undo)
        })
      }
      default:
        return state
    }
  }

  const errorText = 'hardcoded exception'
  const subscriber = ({ from, to }) => {
    if (from.counter !== to.counter) {
      return dispatchUndoCmd(from.counter)
    } else if (from.undo !== to.undo) {
      return immediateThunkCmd(undo => {
        throw new Error(errorText)
      })
    }
  }

  const {
    middleware,
    subscribe,
    registerProviders
  } = serialEffectsMiddleware.withExtraArgument()
  subscribe(subscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))
  registerProviders(dispatchProvider(store.dispatch), thunkProvider())

  try {
    store.dispatch({
      type: SET_COUNTER,
      value: 1
    })
  } catch (e) {
    t.equal(e.message, errorText, 'expected exception caught')
  }
  t.end()
})

test('should recover the queue after an exception in provider code', function(
  t
) {
  t.plan(1)

  const FOO = 'FOO'
  const initialState = {
    counter: 0,
    undo: [],
    foo: undefined
  }
  const reducer = (state = initialState, action) => {
    switch (action.type) {
      case SET_COUNTER: {
        return Object.assign({}, state, { counter: action.value })
      }
      case ADD_UNDO: {
        return Object.assign({}, state, {
          undo: state.undo.concat(action.undo)
        })
      }
      case FOO: {
        return Object.assign({}, state, {
          foo: action.foo
        })
      }
      default:
        return state
    }
  }

  const errorText = 'hardcoded exception'
  const subscriber = ({ from, to }) => {
    if (from.counter !== to.counter) {
      return queuedThunkCmd(undo => {
        return dispatchCmd({ type: ADD_UNDO, unde: from.counter })
      })
    } else if (from.undo !== to.undo) {
      return immediateThunkCmd(undo => {
        try {
          store.dispatch({ type: FOO, foo: 'foo' })
        } catch (e) {}
      })
    } else if (to.foo && from.foo !== to.foo) {
      return immediateThunkCmd(undo => {
        throw new Error(errorText)
      })
    }
  }

  const {
    middleware,
    subscribe,
    registerProviders
  } = serialEffectsMiddleware.withExtraArgument()
  subscribe(subscriber)
  const store = createStore(reducer, initialState, applyMiddleware(middleware))
  registerProviders(dispatchProvider(store.dispatch), thunkProvider())

  return store
    .dispatch({
      type: SET_COUNTER,
      value: 1
    })
    .catch(() => t.fail('should not have caught an exception'))
    .then(() => t.pass())
})
