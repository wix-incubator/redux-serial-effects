'use strict'

const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const { expect } = chai
chai.should()

const { createStore, applyMiddleware, combineReducers } = require('redux')
const { combineSubscribers, serialEffectsMiddleware } = require('../src/index')

/* global describe, it */

describe('serial effects', function() {
  const SET_COUNTER = 'SET_COUNTER'
  const ADD_UNDO = 'ADD_UNDO'

  const unhandledRejectionListener = reason => {
    console.warn('Unhandled rejection:', reason) // eslint-disable-line no-console
  }
  process.on('unhandledRejection', unhandledRejectionListener)

  describe('subscriber API', function() {
    it('should return to idle state when all side-effects have resolved', function(
      done
    ) {
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
              if (to.counter === 2) {
                sideEffectsDone = true
              }
              resolve()
            }, 20)
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
        expect(sideEffectsPromiseResolved).to.be.true
        done()
      })

      Promise.all([
        store.dispatch({ type: SET_COUNTER, value: 1 }),
        store.dispatch({ type: SET_COUNTER, value: 2 })
      ]).then(() => {
        sideEffectsPromiseResolved = true
        expect(sideEffectsDone).to.be.true
        expect(store.getState().counter).to.equal(2)
      })
    })

    it('should call idle callback once per transition back to idle', function(
      done
    ) {
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

      let sideEffectsDone = false
      const subscriber = ({ from, to }) => {
        if (from.counter !== to.counter) {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              sideEffectsDone = true
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
        expect(sideEffectsDone).to.be.true
        expect(idleCalls).to.equal(2)
        done()
      }, 50)
    })

    it('should not call unsubscribed idle callback', function(done) {
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

      let sideEffectsDone = false
      const subscriber = ({ from, to }) => {
        if (from.counter !== to.counter) {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              sideEffectsDone = true
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
        idleCalls = idleCalls + 1
      })()

      store.dispatch({ type: SET_COUNTER, value: 1 })

      setTimeout(() => {
        expect(sideEffectsDone).to.be.true
        expect(idleCalls).to.equal(0)
        done()
      }, 50)
    })

    it('should not call unsubscribed subscribers', function() {
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
        expect(subscriberCalled).to.be.false
      })
    })

    it('should not break when unsubscribing an already unsubscribed subscriber', function() {
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

      let unsubscriberCalled = false
      const unsubscriber = ({ from, to }) => {
        unsubscriberCalled = true
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
      const unsubscribeUnsubscriber = subscribe(unsubscriber)

      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      unsubscribeUnsubscriber()
      unsubscribeUnsubscriber()

      return store.dispatch({ type: SET_COUNTER, value: 1 }).then(() => {
        expect(unsubscriberCalled).to.be.false
        expect(subscriberCalled).to.be.true
      })
    })

    it('should not call subscribers when the dispatched action does not change the state', function() {
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
        expect(subscriberCalled).to.be.false
      })
    })

    it('should not go back to idle mode before side-effects have completely resolved', function(
      done
    ) {
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

      let sideEffectsDone
      const subscriber = ({ from, to }) => {
        if (!sideEffectsDone) {
          return new Promise((resolve, reject) => {
            sideEffectsDone = () => resolve()
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

      let isIdle = false
      onIdle(() => {
        isIdle = true
      })

      store.dispatch({ type: SET_COUNTER, value: 1 })

      setTimeout(() => {
        expect(isIdle).to.be.false
        sideEffectsDone()
        setTimeout(() => {
          expect(isIdle).to.be.true
          done()
        }, 0)
      }, 10)
    })

    it('should pass the actual state, and expected state to subscribers', function() {
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
        expect(from).to.deep.equal(initialState)
        expect(to).to.deep.equal({ counter: 1 })
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

    it('should handle exceptions in subscriber code', function(done) {
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

      let caughtException = false
      const listeners = process.listeners('unhandledRejection')
      process.on('unhandledRejection', () => {
        caughtException = true
      })

      onIdle(() => {
        expect(caughtException).to.be.false

        process.removeAllListeners('unhandledRejection')
        for (const listener of listeners) {
          process.on('unhandledRejection', listener)
        }

        expect(store.getState().counter).to.equal(2)
        done()
      })

      store.dispatch({ type: SET_COUNTER, value: 1 })
      store.dispatch({ type: SET_COUNTER, value: 2 })
    })

    it('should work with subscribers that return promise chains', function(
      done
    ) {
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

      let sideEffectsDone = false
      const subscriber = ({ from, to }) => {
        if (from.counter !== to.counter) {
          return new Promise((resolve, reject) => {
            setTimeout(resolve, 20)
          }).then(() => {
            sideEffectsDone = true
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

      store.dispatch({ type: SET_COUNTER, value: 1 })

      onIdle(() => {
        expect(sideEffectsDone).to.be.true
        done()
      })
    })

    it('should dispatch an action returned from side-effects chain', function(
      done
    ) {
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
        onIdle,
        subscribe
      } = serialEffectsMiddleware.withExtraArgument()
      subscribe(subscriber)
      const store = createStore(
        reducer,
        initialState,
        applyMiddleware(middleware)
      )

      store.dispatch({ type: SET_COUNTER, value: 1 })

      onIdle(() => {
        expect(store.getState().mirroredCounter).to.equal(
          store.getState().counter
        )
        done()
      })
    })

    it('should invoke subscribers only after previous side-effect promises have resolved/rejected', function(
      done
    ) {
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

      let resolveSideEffect
      let sideEffectsDone
      const subscriber = ({ from, to }) => {
        if (to.counter === 1) {
          if (!sideEffectsDone) {
            return new Promise((resolve, reject) => {
              resolveSideEffect = () => {
                sideEffectsDone = true
                resolve()
              }
            })
          }
        } else if (to.counter === 2) {
          expect(sideEffectsDone).to.equal(true)
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

      let isIdle = false
      onIdle(() => {
        isIdle = true
      })

      store.dispatch({ type: SET_COUNTER, value: 1 })
      store.dispatch({ type: SET_COUNTER, value: 2 })

      setTimeout(() => {
        expect(isIdle).to.be.false
        resolveSideEffect()
        setTimeout(() => {
          expect(isIdle).to.be.true
          done()
        }, 0)
      }, 10)
    })

    it('should return a promise that resolves when all subscribers are done', function() {
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

      const subscriberPromise = store.dispatch({ type: SET_COUNTER, value: 1 })
      expect(store.getState().counter).to.equal(1)
      return subscriberPromise.then(() => {
        expect(firstSubscriberDone).to.be.true
        expect(secondSubscriberDone).to.be.true
      })
    })

    it('should return a promise that rejects if at least one subscriber rejected its promise', function() {
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

      const subscriberPromise = store.dispatch({ type: SET_COUNTER, value: 1 })
      expect(store.getState().counter).to.equal(1)
      return subscriberPromise.should.be.rejectedWith('hardcoded rejection')
    })

    it('should return a promise that resolves only after all related dispatched actions are resolved', function() {
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

      const subscriberPromise = store.dispatch({ type: SET_COUNTER, value: 1 })
      return subscriberPromise.then(() => {
        expect(sideEffectsDone).to.be.true
        expect(store.getState().counter).to.equal(1)
        expect(store.getState().undo).to.eql([0])
      })
    })

    it('should allow subscribers to resolve to an array of actions to dispatch', function() {
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

      const subscriberPromise = store.dispatch({ type: SET_COUNTER, value: 1 })
      return subscriberPromise.then(() => {
        expect(store.getState().counter).to.equal(1)
        expect(store.getState().undo).to.eql([0])
        expect(store.getState().lastValue).to.equal(0)
      })
    })
  })

  describe('combineSubscribers', function() {
    it('should compose subscribers', function() {
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

      return store.dispatch({ type: SET_COUNTER, value: 1 }).then(() => {
        expect(triggeredSubscribers.length).to.equal(2)
      })
    })
  })
})
