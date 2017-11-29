'use strict'

const { expect } = require('chai')
const { createStore, applyMiddleware, combineReducers } = require('redux')
const { combineSubscribers, serialEffectsMiddleware } = require('../src/index')

/* global describe, it */

describe('serial effects', function() {
  const SET_COUNTER = 'SET_COUNTER'

  const unhandledRejectionListener = reason => {
    console.warn('Unhandled rejection:', reason) // eslint-disable-line no-console
  }
  process.on('unhandledRejection', unhandledRejectionListener)

  describe('subscriber API', function() {
    it('should return to idle state when all side-effects have resolved', function(done) {
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
      const { middleware, onIdle, subscribe } = serialEffectsMiddleware.withExtraArgument()
      subscribe(subscriber)
      const store = createStore(reducer, initialState, applyMiddleware(middleware))

      let sideEffectsDone = false

      onIdle(() => {
        expect(sideEffectsDone).to.be.true
        expect(store.getState().counter).to.equal(2)
        done()
      })

      store.dispatch({ type: SET_COUNTER, value: 1 })
      store.dispatch({ type: SET_COUNTER, value: 2 })
    })

    it('should call idle callback once per transition back to idle', function(done) {
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
            }, 20)
          })
        }
      }

      const { middleware, onIdle, subscribe } = serialEffectsMiddleware.withExtraArgument()
      subscribe(subscriber)
      const store = createStore(reducer, initialState, applyMiddleware(middleware))

      let idleCalls = 0

      onIdle(() => {
        idleCalls = idleCalls + 1
      })

      store.dispatch({ type: SET_COUNTER, value: 1 })

      setTimeout(() => {
        expect(sideEffectsDone).to.be.true
        expect(idleCalls).to.equal(1)
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
            }, 20)
          })
        }
      }

      const { middleware, onIdle, subscribe } = serialEffectsMiddleware.withExtraArgument()
      subscribe(subscriber)
      const store = createStore(reducer, initialState, applyMiddleware(middleware))

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

      const { middleware, onIdle, subscribe } = serialEffectsMiddleware.withExtraArgument()
      subscribe(subscriber)
      const store = createStore(reducer, initialState, applyMiddleware(middleware))

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

      const { middleware, subscribe } = serialEffectsMiddleware.withExtraArgument()
      subscribe(subscriber)
      const store = createStore(reducer, initialState, applyMiddleware(middleware))

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

      const { middleware, onIdle, subscribe } = serialEffectsMiddleware.withExtraArgument()
      subscribe(subscriber)
      const store = createStore(reducer, initialState, applyMiddleware(middleware))

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

    it('should work with subscribers that return promise chains', function(done) {
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

      const { middleware, onIdle, subscribe } = serialEffectsMiddleware.withExtraArgument()
      subscribe(subscriber)
      const store = createStore(reducer, initialState, applyMiddleware(middleware))

      store.dispatch({ type: SET_COUNTER, value: 1 })

      onIdle(() => {
        expect(sideEffectsDone).to.be.true
        done()
      })
    })

    it('should dispatch an action returned from side-effects chain', function(done) {
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
          return new Promise((resolve, reject) => {
            store.dispatch({ type: MIRRORED_ACTION, value: to.counter })
            resolve()
          })
        }
      }

      const { middleware, onIdle, subscribe } = serialEffectsMiddleware.withExtraArgument()
      subscribe(subscriber)
      const store = createStore(reducer, initialState, applyMiddleware(middleware))

      store.dispatch({ type: SET_COUNTER, value: 1 })

      onIdle(() => {
        expect(store.getState().mirroredCounter).to.equal(store.getState().counter)
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

      const { middleware, onIdle, subscribe } = serialEffectsMiddleware.withExtraArgument()
      subscribe(subscriber)
      const store = createStore(reducer, initialState, applyMiddleware(middleware))

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
  })

  describe('counter list example', function() {
    //const ADD_ACOUNTER = 'add-counter'
    //const REMOVE_ACOUNTER = 'remove-counter'
    const INCREMENT = 'increment'
    const DECREMENT = 'decrement'
    const LOST_SYNC = 'lost-sync'

    const counterReducer = id => (state = { id, counter: 0, inSync: true }, action) => {
      if (action.id !== state.id) return state

      switch (action.type) {
        case INCREMENT: {
          return Object.assign({}, state, { counter: state.counter + 1 })
        }
        case DECREMENT: {
          return Object.assign({}, state, { counter: state.counter - 1 })
        }
        case LOST_SYNC: {
          return Object.assign({}, state, { inSync: false })
        }
        default:
          return state
      }
    }

    const increment = id => ({ type: INCREMENT, id })

    //const decrement = id => ({ type: DECREMENT, id })

    const lostSync = id => ({ type: LOST_SYNC, id })

    const counterSubscriber = backendService => ({ from, to }, dispatch) => {
      // backendService is an API client that returns a promise for each API
      // call, it is scoped to the counter's state
      if (from.counter !== to.counter) {
        // the counter value has changed, update the backend with an infite
        // retry
        const update = (retryCount = 2) => {
          return backendService.setValue(to.counter).catch(() => {
            if (retryCount) {
              return update(retryCount - 1)
            } else {
              dispatch(lostSync(to.id))
              return Promise.resolve()
            }
          })
        }
        return update()
      }
    }

    const backendService = scope => {
      let shouldFail = false
      let _value = 0
      return {
        get shouldFail() {
          return shouldFail
        },
        set shouldFail(value) {
          shouldFail = value
        },
        get value() {
          return _value
        },
        setValue(value) {
          return new Promise((resolve, reject) => {
            // call external API to set `value` in `scope`
            setTimeout(() => {
              if (shouldFail) {
                reject(new Error('hardcoded error'))
              } else {
                _value = value
                resolve()
              }
            }, 5)
          })
        }
      }
    }

    it('should compose subscribers', function(done) {
      const counterList = [1, 2, 3, 4]
      const reducerMap = {}
      const subscriberMap = {}
      const backendServices = []

      for (const counter in counterList) {
        const counterName = `counter${counterList[counter]}`
        const service = backendService(counterName)

        reducerMap[counterName] = counterReducer(counterList[counter])
        subscriberMap[counterName] = counterSubscriber(service)
        backendServices.push(service)
      }
      const reducer = combineReducers(reducerMap)
      const subscriber = combineSubscribers(subscriberMap)

      const { middleware, onIdle, subscribe } = serialEffectsMiddleware.withExtraArgument()
      subscribe(subscriber)
      const store = createStore(reducer, applyMiddleware(middleware))

      onIdle(() => {
        expect(store.getState().counter1).to.deep.equal({ id: 1, counter: 1, inSync: true })
        expect(backendServices[0].value).to.equal(1)
        expect(store.getState().counter2).to.deep.equal({ id: 2, counter: 0, inSync: true })
        expect(backendServices[1].value).to.equal(0)
        expect(store.getState().counter3).to.deep.equal({ id: 3, counter: 0, inSync: true })
        expect(backendServices[2].value).to.equal(0)
        expect(store.getState().counter4).to.deep.equal({ id: 4, counter: 0, inSync: true })
        expect(backendServices[3].value).to.equal(0)
        done()
      })

      store.dispatch(increment(1))
    })

    it('should be able to dispatch actions from subscribers', function(done) {
      const counterList = [1, 2, 3, 4]
      const reducerMap = {}
      const subscriberMap = {}
      const backendServices = []

      for (const counter in counterList) {
        const counterName = `counter${counterList[counter]}`
        const service = backendService(counterName)

        reducerMap[counterName] = counterReducer(counterList[counter])
        subscriberMap[counterName] = counterSubscriber(service)
        backendServices.push(service)
      }
      const reducer = combineReducers(reducerMap)
      const subscriber = combineSubscribers(subscriberMap)

      const { middleware, onIdle, subscribe } = serialEffectsMiddleware.withExtraArgument()
      subscribe(subscriber)
      const store = createStore(reducer, applyMiddleware(middleware))

      onIdle(() => {
        expect(store.getState().counter1).to.deep.equal({ id: 1, counter: 1, inSync: false })
        expect(backendServices[0].value).to.equal(0)
        expect(store.getState().counter2).to.deep.equal({ id: 2, counter: 0, inSync: true })
        expect(backendServices[1].value).to.equal(0)
        expect(store.getState().counter3).to.deep.equal({ id: 3, counter: 0, inSync: true })
        expect(backendServices[2].value).to.equal(0)
        expect(store.getState().counter4).to.deep.equal({ id: 4, counter: 0, inSync: true })
        expect(backendServices[3].value).to.equal(0)
        done()
      })

      backendServices[0].shouldFail = true
      store.dispatch(increment(1))
    })
  })

  describe('vm example', function() {
    // actions
    const CREATE = 'create'
    const DELETE = 'delete'
    const CONNECT = 'connect'
    const DISCONNECT = 'disconnect'
    const GC = 'GC'

    // vm state
    const CREATED = 'created'

    // reducer
    const initialState = {
      vmsById: {},
      vmList: [],
      toGC: []
    }
    let uuidGen = () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })
    const reducer = (state = initialState, action) => {
      switch (action.type) {
        case CREATE: {
          const vm = {
            id: uuidGen(),
            host: action.host,
            connected: false,
            state: CREATED
          }
          return Object.assign({}, state, {
            vmsById: Object.assign({}, state.vmsById, {
              [vm.id]: vm
            }),
            vmList: [...state.vmList, vm.id]
          })
        }
        case CONNECT: {
          const vm = Object.assign({}, state.vmsById[action.vm], {
            connected: true
          })
          return Object.assign({}, state, {
            vmsById: Object.assign({}, state.vmsById, {
              [vm.id]: vm
            })
          })
        }
        case DISCONNECT: {
          const vm = Object.assign({}, state.vmsById[action.vm], {
            connected: false
          })
          return Object.assign({}, state, {
            vmsById: Object.assign({}, state.vmsById, {
              [action.vm]: vm
            })
          })
        }
        case DELETE: {
          return Object.assign({}, state, {
            vmsById: Object.keys(state.vmsById)
              .filter(key => key !== action.vm)
              .reduce((acc, val) => Object.assign({}, acc, { [val]: state.vmsById[val] }), {}),
            vmList: state.vmList.filter(key => key !== action.vm),
            toGC: state.toGC.concat(action.vm)
          })
        }
        case GC: {
          return Object.assign({}, state, { toGC: state.toGC.filter(vm => vm !== action.vm) })
        }
        default:
          return state
      }
    }

    describe('test-case tests', function() {
      it('reducer should create a new vm', function() {
        uuidGen = () => 1

        const newState = reducer(initialState, { type: CREATE, host: 1 })
        expect(newState).to.deep.equal({
          vmsById: { 1: { id: 1, host: 1, connected: false, state: CREATED } },
          vmList: [1],
          toGC: []
        })
      })

      it('reducer should delete a vm', function() {
        uuidGen = () => 1

        let newState = reducer(initialState, { type: CREATE, host: 1 })
        expect(newState).to.deep.equal({
          vmsById: { 1: { id: 1, host: 1, connected: false, state: CREATED } },
          vmList: [1],
          toGC: []
        })

        newState = reducer(initialState, { type: DELETE, vm: 1 })
        expect(newState).to.deep.equal({ vmsById: {}, vmList: [], toGC: [1] })
      })

      it('reducer should connect a vm', function() {
        let counter = 0
        uuidGen = () => {
          counter = counter + 1
          return counter
        }

        let newState = reducer(initialState, { type: CREATE, host: 1 })
        expect(newState).to.deep.equal({
          vmsById: {
            1: { id: 1, host: 1, connected: false, state: CREATED }
          },
          vmList: [1],
          toGC: []
        })

        newState = reducer(newState, { type: CREATE, host: 1 })
        expect(newState).to.deep.equal({
          vmsById: {
            1: { id: 1, host: 1, connected: false, state: CREATED },
            2: { id: 2, host: 1, connected: false, state: CREATED }
          },
          vmList: [1, 2],
          toGC: []
        })

        newState = reducer(newState, { type: CONNECT, vm: 1 })
        expect(newState).to.deep.equal({
          vmsById: {
            1: { id: 1, host: 1, connected: true, state: CREATED },
            2: { id: 2, host: 1, connected: false, state: CREATED }
          },
          vmList: [1, 2],
          toGC: []
        })
      })

      it('reducer should disconnect a vm', function() {
        let counter = 0
        uuidGen = () => {
          counter = counter + 1
          return counter
        }

        let newState = reducer(initialState, { type: CREATE, host: 1 })
        expect(newState).to.deep.equal({
          vmsById: {
            1: { id: 1, host: 1, connected: false, state: CREATED }
          },
          vmList: [1],
          toGC: []
        })

        newState = reducer(newState, { type: CREATE, host: 1 })
        expect(newState).to.deep.equal({
          vmsById: {
            1: { id: 1, host: 1, connected: false, state: CREATED },
            2: { id: 2, host: 1, connected: false, state: CREATED }
          },
          vmList: [1, 2],
          toGC: []
        })

        newState = reducer(newState, { type: CONNECT, vm: 1 })
        expect(newState).to.deep.equal({
          vmsById: {
            1: { id: 1, host: 1, connected: true, state: CREATED },
            2: { id: 2, host: 1, connected: false, state: CREATED }
          },
          vmList: [1, 2],
          toGC: []
        })

        newState = reducer(newState, { type: DISCONNECT, vm: 1 })
        expect(newState).to.deep.equal({
          vmsById: {
            1: { id: 1, host: 1, connected: false, state: CREATED },
            2: { id: 2, host: 1, connected: false, state: CREATED }
          },
          vmList: [1, 2],
          toGC: []
        })
      })

      it('reducer should GC a vm', function() {
        uuidGen = () => 1

        let newState = reducer(initialState, { type: CREATE, host: 1 })
        expect(newState).to.deep.equal({
          vmsById: { 1: { id: 1, host: 1, connected: false, state: CREATED } },
          vmList: [1],
          toGC: []
        })

        newState = reducer(initialState, { type: DELETE, vm: 1 })
        expect(newState).to.deep.equal({ vmsById: {}, vmList: [], toGC: [1] })
      })
    })

    it('should hangle the GC of deleted VMs in the background', function(done) {
      // logic for disconnecting deleted vms
      const subscriber = ({ from, to }, dispatch) => {
        // select all vms that were deleted by this action
        if (from.toGC !== to.toGC) {
          return Promise.all(
            to.toGC.filter(vm => !from.toGC.find(togc => togc === vm)).map(
              vm =>
                new Promise((resolve, reject) =>
                  setTimeout(() => {
                    dispatch({ type: GC, vm })
                    resolve()
                  }, 10)
                )
            )
          )
        }
      }

      const { middleware, onIdle, subscribe } = serialEffectsMiddleware.withExtraArgument()
      subscribe(subscriber)
      const store = createStore(reducer, initialState, applyMiddleware(middleware))

      store.dispatch({ type: CREATE, host: 1 })
      expect(store.getState().vmList.length).to.equal(1)
      store.dispatch({ type: CREATE, host: 1 })
      expect(store.getState().vmList.length).to.equal(2)
      store.dispatch({ type: CREATE, host: 1 })
      expect(store.getState().vmList.length).to.equal(3)
      store.dispatch({ type: CONNECT, vm: store.getState().vmList[0] })
      expect(store.getState().vmList.length).to.equal(3)
      store.dispatch({ type: CONNECT, vm: store.getState().vmList[1] })
      expect(store.getState().vmList.length).to.equal(3)
      const vmToRemove = store.getState().vmList[0]

      onIdle(() => {
        try {
          expect(store.getState().vmList.length).to.equal(2)
          expect(store.getState().toGC).to.be.empty
          done()
        } catch (ex) {
          done(ex)
        }
      })

      store.dispatch({ type: DELETE, vm: vmToRemove })
    })
  })
})
