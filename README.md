# Redux Serial Effects

Predictable side-effect middleware for the predictable state container.

## Approach

Serial effects does two things:

1. Implement an Elm-like architecture for executing side-effects
1. Manage a queue of side-effects for execution (hence the name)

The first promotes DRYness, reduces fragmentation of business logic, and increases composability.
The second makes side-effects predictable by executing side-effects in the order they were
generated.

### Generating Side-effects

Side-effects are generated in similar fashion to the Elm Architecture. The most notable difference
being that the `reducer` is not responsible for generating side-effects. A new player is involved,
called `subscriber`, which differs from a Redux listener in several aspects:

1. You can compose subscribers like you do with reducers. Each subscriber will only monitor changes
   to its own slice of the state. However, there's nothing preventing you from composing subscribers
   differently than you do your reducers.
1. Subscribers are only called if the slice of state they were assigned to changed.
1. Subscribers receive both the state before the dispatched action was processed by the reducers
   (a.k.a. `from`), and the final state after the reducer changed it (a.k.a. `to`).
1. There may be multiple root subscribers at any given time. All root subscribers are called when
   the state changes

Serial-effects tracks changes to the state, and each time a change is detected, calls all registered
subscribers. Each subscriber may return a list of commands to execute. Commands are pure-data
objects that describe the side-effects to execute. Serial-effects will collect all these commands
and will execute them as described in the next section.

Execution is done using executors: reducer-like functions that take commands and perform the actual
side-effects. Each command has a type, binding it to a specific executor that has been previously
registered with the middleware.

### Executing Side-effects

Once all subscribers have been called for a given state transition, and have returned their lists of
commands to execute, Serial-effects will organise these commands in two groups: immediate, and
queued.

Immediate commands are executed synchronously before `dispatch` returns. Any exception thrown by an
immediate command is thrown to the code that called `dispatch`. Any promises returned by immediate
commands are ignored.

Once all immediate commands have completed, queued commands are put into the middleware's internal
execution queue, to be executed when their turn arrives. Dispatch will then return. All queued
commands produced by a single transition are queued together and will be executed concurrently. The
queue will wait for all promises returned by these commands before advancing to the next group of
queued commands. It stops waiting if any promise is rejected, and execution rights are passed to the
next group of queued commands.

### Completion Actions

Each command may specify which action should be dispatched, if any, when it completes.  For every
command that completes, either successfully or not, the middleware will dispatch the action to the
store, with the command's results. 

The action's payload will hold whether the command completed successfully or not, and what value or
error it returned or resolved/rejected with.

## Usage

```javascript
const { createStore, applyMiddleware } = require('redux')
const {
  createMiddleware,
  matchAction,
  createQueuedCmd
} = require('redux-serial-effects')

// actions
const SET_DISPLAY_ITEM = 'SET_DISPLAY_ITEM'
const DATA_RESPONSE = 'DATA_RESPONSE'

// commands
const GET_DATA_BY_ID = 'GET_DATA_BY_ID'

const EXECUTOR_TYPE = 'DATA_SERVICE_CLIENT'

const remoteDataServiceClient = {
  type: EXECUTOR_TYPE,
  execute: cmd => {
    switch (cmd.type) {
      case GET_DATA_BY_ID: {
        // async network operation
        return new Promise((resolve, reject) => {
          setTimeout(() => resolve({ content: 'item data' }), 10)
        })
      }
    }
  }
}

const getDataFromRemoteServiceCmd = (id, actionType) =>
  createQueuedCmd(
    EXECUTOR_TYPE,
    {
      type: GET_DATA_BY_ID,
      id
    },
    actionType
  )

const setItemToDisplay = id => ({
  type: SET_DISPLAY_ITEM,
  id
})

const initialState = {
  itemToDisplay: {
    id: 0,
    data: {}
  },
  errorState: false,
  errorDescription: null
}

const reducer = (state, action) => {
  switch (action.type) {
    case SET_DISPLAY_ITEM: {
      return Object.assign({}, state, {
        itemToDisplay: Object.assign({}, state.itemToDisplay, {
          id: action.id
        })
      })
    }
    case DATA_RESPONSE: {
      return matchAction(action, {
        Error: error => {
          return Object.assign({}, state, {
            errorState: true,
            errorDescription: error
          })
        },
        Ok: data => {
          return Object.assign({}, state, {
            errorState: false,
            errorDescription: null,
            itemToDisplay: Object.assign({}, state.itemToDisplay, { data })
          })
        }
      })
    }
    default:
      return state
  }
}

const getDisplayItemId = state => state.itemToDisplay.id

const subscriber = ({ from, to, isChanged }) => {
  if (isChanged(getDisplayItemId)) {
    return getDataFromRemoteServiceCmd(to.itemToDisplay.id, DATA_RESPONSE)
  }
}

const { middleware, subscribe, registerExecutors } = createMiddleware()
subscribe(subscriber)
const store = createStore(reducer, initialState, applyMiddleware(middleware))
registerExecutors(remoteDataServiceClient)

store.dispatch(setItemToDisplay(1))
```

## Status of the API

Public API is not stable yet.

Version 0.0.13 include a breaking change to the API.
