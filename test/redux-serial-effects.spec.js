'use strict'

const test = require('tape')

const { createStore, applyMiddleware, combineReducers } = require('redux')
const { combineSubscribers, serialEffectsMiddleware } = require('../src/index')

const SET_COUNTER = 'SET_COUNTER'
const ADD_UNDO = 'ADD_UNDO'

const unhandledRejectionListener = reason => {
  console.warn('Unhandled rejection:', reason) // eslint-disable-line no-console
}
process.on('unhandledRejection', unhandledRejectionListener)

test('serial-effect middleware', function(t) {
  t.test('should change the state synchronously', function(st) {
    st.plan(1)

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
    const store = createStore(
      reducer,
      initialState,
      applyMiddleware(middleware)
    )

    store.dispatch({ type: SET_COUNTER, value: 1 })
    store.dispatch({ type: SET_COUNTER, value: 2 })

    st.deepEqual(
      store.getState(),
      { counter: 2 },
      'state was updated synchronously'
    )
  })

  t.test(
    'should return to idle state only after all side-effects have resolved',
    function(st) {
      st.plan(2)

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
        if (from.counter !== to.counter) {
          return new Promise((resolve, reject) => {
            setTimeout(resolve, 20)
          }).then(() => {
            if (to.counter === 2) {
              sideEffectsDone = true
            }
          })
        }
      }
      const {
        middleware,
        onIdle,
        subscribe
      } = serialEffectsMiddleware.withExtraArgument()
      subscribe(subscriber)
      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      let sideEffectsDone = false
      let sideEffectsPromiseResolved = false

      onIdle(() => {
        st.true(
          sideEffectsPromiseResolved,
          'returned to idle after side-effects have resolved'
        )
        st.end()
      })

      Promise.all([
        store.dispatch({ type: SET_COUNTER, value: 1 }),
        store.dispatch({ type: SET_COUNTER, value: 2 })
      ]).then(() => {
        sideEffectsPromiseResolved = true
        st.true(sideEffectsDone, 'promise resolved on side-effects resolution')
      })
    }
  )

  t.test('should call idle callback once per transition back to idle', function(
    st
  ) {
    st.plan(1)

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
      if (from.counter !== to.counter) {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            resolve()
          }, 10)
        })
      }
    }

    const {
      middleware,
      onIdle,
      subscribe
    } = serialEffectsMiddleware.withExtraArgument()
    subscribe(subscriber)
    const store = createStore(
      reducer,
      initialState,
      applyMiddleware(middleware)
    )

    let idleCalls = 0

    onIdle(() => {
      if (store.getState().counter === 1) {
        store.dispatch({ type: SET_COUNTER, value: 2 })
      }
      idleCalls = idleCalls + 1
    })

    store.dispatch({ type: SET_COUNTER, value: 1 })

    setTimeout(() => {
      st.equal(idleCalls, 2, 'idle callback called correct number of times')
    }, 50)
  })

  t.test('should not call an unsubscribed idle callback', function(st) {
    st.plan(1)

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
      if (from.counter !== to.counter) {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            resolve()
          }, 5)
        })
      }
    }

    const {
      middleware,
      onIdle,
      subscribe
    } = serialEffectsMiddleware.withExtraArgument()
    subscribe(subscriber)
    const store = createStore(
      reducer,
      initialState,
      applyMiddleware(middleware)
    )

    let idleCalls = 0

    onIdle(() => {
      idleCalls = idleCalls + 1
    })()

    store.dispatch({ type: SET_COUNTER, value: 1 })

    setTimeout(() => {
      st.equal(idleCalls, 0, 'idle callback was not called')
    }, 10)
  })

  t.test('should not call unsubscribed subscribers', function(st) {
    st.plan(1)

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

    const {
      middleware,
      subscribe
    } = serialEffectsMiddleware.withExtraArgument()
    subscribe(subscriber)()
    const store = createStore(
      reducer,
      initialState,
      applyMiddleware(middleware)
    )

    return store.dispatch({ type: SET_COUNTER, value: 1 }).then(() => {
      st.false(subscriberCalled, 'subscriber was not called')
    })
  })

  t.test(
    'should not break when unsubscribing an already unsubscribed subscriber',
    function(st) {
      st.plan(1)

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

      const unsubscriber = () => st.fail('unsubscribed subscriber called')

      let subscriberCalled = false
      const subscriber = ({ from, to }) => {
        subscriberCalled = true
      }

      const {
        middleware,
        subscribe
      } = serialEffectsMiddleware.withExtraArgument()
      subscribe(subscriber)
      const unsubscribeUnsubscriber = subscribe(unsubscriber)

      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      unsubscribeUnsubscriber()
      unsubscribeUnsubscriber()

      return store.dispatch({ type: SET_COUNTER, value: 1 }).then(() => {
        st.true(subscriberCalled, 'registered subscriber called')
      })
    }
  )

  t.test(
    'should not call subscribers when the dispatched action does not change the state',
    function(st) {
      st.plan(1)

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

      const {
        middleware,
        subscribe
      } = serialEffectsMiddleware.withExtraArgument()
      subscribe(subscriber)
      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      return store.dispatch({ type: ADD_UNDO, undo: [] }).then(() => {
        st.false(subscriberCalled, 'subscriber was not called')
      })
    }
  )

  t.test('should handle exceptions in subscriber code', function(st) {
    st.plan(1)

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
      }

      return () => Promise.resolve()
    }

    const {
      middleware,
      onIdle,
      subscribe
    } = serialEffectsMiddleware.withExtraArgument()
    subscribe(subscriber)
    const store = createStore(
      reducer,
      initialState,
      applyMiddleware(middleware)
    )

    onIdle(() => {
      st.equal(
        store.getState().counter,
        2,
        "second action was handled correctly after the first's promise rejected"
      )
    })

    store.dispatch({ type: SET_COUNTER, value: 1 })
    store.dispatch({ type: SET_COUNTER, value: 2 })
  })

  t.test(
    'should invoke subscribers only after previous side-effect promises have resolved/rejected',
    function(st) {
      st.plan(1)

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

      let resolveSideEffect = () => {}
      let sideEffectsDone = false
      const sideEffectPromise = new Promise((resolve, reject) => {
        resolveSideEffect = () => {
          sideEffectsDone = true
          resolve()
        }
      })

      const subscriber = ({ from, to }) => {
        if (to.counter === 1) {
          if (!sideEffectsDone) {
            return sideEffectPromise
          }
        } else if (to.counter === 2) {
          st.true(
            sideEffectsDone,
            'second change subscribers called waited on first change side-effects'
          )
        }
      }

      const {
        middleware,
        subscribe
      } = serialEffectsMiddleware.withExtraArgument()
      subscribe(subscriber)
      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      store.dispatch({ type: SET_COUNTER, value: 1 })
      store.dispatch({ type: SET_COUNTER, value: 2 })

      setTimeout(resolveSideEffect, 10)
    }
  )

  t.test('should dispatch an action returned from side-effects chain', function(
    st
  ) {
    st.plan(1)

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
        return Promise.resolve({ type: MIRRORED_ACTION, value: to.counter })
      }
    }

    const {
      middleware,
      subscribe
    } = serialEffectsMiddleware.withExtraArgument()
    subscribe(subscriber)
    const store = createStore(
      reducer,
      initialState,
      applyMiddleware(middleware)
    )

    store.dispatch({ type: SET_COUNTER, value: 1 }).then(() => {
      st.equal(
        store.getState().mirroredCounter,
        store.getState().counter,
        'action dispatched'
      )
    })
  })

  t.test(
    'should return a promise that resolves when all subscribers are done',
    function(st) {
      st.plan(2)

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
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              firstSubscriberDone = true
              resolve()
            }, 20)
          })
        }
      }

      const secondSubscriber = ({ from, to }) => {
        if (from.counter !== to.counter) {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              secondSubscriberDone = true
              resolve()
            }, 20)
          })
        }
      }

      const {
        middleware,
        subscribe
      } = serialEffectsMiddleware.withExtraArgument()
      subscribe(firstSubscriber)
      subscribe(secondSubscriber)
      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      let firstSubscriberDone = false
      let secondSubscriberDone = false

      const subscriberPromise = store.dispatch({
        type: SET_COUNTER,
        value: 1
      })

      return subscriberPromise.then(() => {
        st.true(firstSubscriberDone, 'first subscriber done')
        st.true(secondSubscriberDone, 'second subscriber done')
      })
    }
  )

  t.test(
    'should return a promise that rejects if at least one subscriber rejected its promise',
    function(st) {
      st.plan(1)

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
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve()
            }, 20)
          })
        }
      }

      const secondSubscriber = ({ from, to }) => {
        if (from.counter !== to.counter) {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              reject(new Error('hardcoded rejection'))
            }, 20)
          })
        }
      }

      const {
        middleware,
        subscribe
      } = serialEffectsMiddleware.withExtraArgument()
      subscribe(firstSubscriber)
      subscribe(secondSubscriber)
      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      store
        .dispatch({
          type: SET_COUNTER,
          value: 1
        })
        .catch(e => {
          st.equal(
            e.message,
            'hardcoded rejection',
            'promise rejected as expected'
          )
        })
    }
  )

  t.test(
    'should return a promise that resolves only after all related dispatched actions are resolved',
    function(st) {
      st.plan(1)

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
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve({
                type: ADD_UNDO,
                undo: to.undo.concat(from.counter)
              })
            }, 20)
          })
        }
      }

      const secondSubscriber = ({ from, to }) => {
        if (from.undo !== to.undo) {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              sideEffectsDone = true
              resolve()
            }, 20)
          })
        }
      }

      const {
        middleware,
        subscribe
      } = serialEffectsMiddleware.withExtraArgument()
      subscribe(firstSubscriber)
      subscribe(secondSubscriber)
      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      let sideEffectsDone = false

      store
        .dispatch({
          type: SET_COUNTER,
          value: 1
        })
        .then(() => {
          st.true(
            sideEffectsDone,
            'promise resolved after side-effects completion'
          )
        })
    }
  )

  t.test(
    'should allow subscribers to resolve to an array of actions to dispatch',
    function(st) {
      st.plan(1)

      const LAST_VALUE = 'LAST_VALUE'
      const initialState = {
        counter: 0,
        undo: [],
        lastValue: undefined
      }
      const reducer = (state = initialState, action) => {
        switch (action.type) {
          case SET_COUNTER: {
            return Object.assign({}, state, { counter: action.value })
          }
          case ADD_UNDO: {
            return Object.assign({}, state, { undo: action.undo })
          }
          case LAST_VALUE: {
            return Object.assign({}, state, { lastValue: action.lastValue })
          }
          default:
            return state
        }
      }

      const firstSubscriber = ({ from, to }) => {
        if (from.counter !== to.counter) {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve([
                {
                  type: ADD_UNDO,
                  undo: to.undo.concat(from.counter)
                },
                {
                  type: LAST_VALUE,
                  lastValue: from.counter
                }
              ])
            }, 20)
          })
        }
      }

      const {
        middleware,
        subscribe
      } = serialEffectsMiddleware.withExtraArgument()
      subscribe(firstSubscriber)
      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      store
        .dispatch({
          type: SET_COUNTER,
          value: 1
        })
        .then(() => {
          st.deepEqual(
            store.getState(),
            {
              counter: 1,
              undo: [0],
              lastValue: 0
            },
            'both actions were dispatched correctly'
          )
        })
    }
  )
})

test('subscribers', function(t) {
  t.test('should receive the previous state and the new state', function(st) {
    st.plan(1)

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
      st.deepEqual(
        states,
        { from: initialState, to: { counter: 1 } },
        'both state objects passed correctly'
      )
    }

    const {
      middleware,
      subscribe
    } = serialEffectsMiddleware.withExtraArgument()
    subscribe(subscriber)
    const store = createStore(
      reducer,
      initialState,
      applyMiddleware(middleware)
    )

    store.dispatch({ type: SET_COUNTER, value: 1 })
  })

  t.test(
    'should receive the extra argument given when creating the middleware',
    function(st) {
      st.plan(1)

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
        st.equal(extra, extraArgument, 'correct extraArgument passed')
      }

      const {
        middleware,
        subscribe
      } = serialEffectsMiddleware.withExtraArgument(extra)
      subscribe(subscriber)
      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      store.dispatch({ type: SET_COUNTER, value: 1 })
    }
  )
})

test('combineSubscribers', function(t) {
  t.test('should compose subscribers', function(st) {
    st.plan(1)

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

    const {
      middleware,
      subscribe
    } = serialEffectsMiddleware.withExtraArgument()
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

    store.dispatch({ type: SET_COUNTER, value: 1 }).then(() => {
      st.equal(
        triggeredSubscribers.length,
        2,
        'the correct subscribers were called'
      )
    })
  })
})
