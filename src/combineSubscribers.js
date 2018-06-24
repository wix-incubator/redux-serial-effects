// @flow
'use strict'

const { flatten } = require('./utils/flatten')
const createTransition = require('./utils/transition')

import type { Transition } from './utils/transition'
import type { Subscriber } from './middleware'

const combineSubscribers = (subscriberMap: { [string]: Subscriber }) => (
  transition: Transition,
  extraArgument: ?mixed
) =>
  flatten(
    Object.keys(subscriberMap).map(
      key =>
        transition.from[key] !== transition.to[key] && subscriberMap[key]
          ? [].concat(
              subscriberMap[key](
                createTransition(transition.from[key], transition.to[key]),
                extraArgument
              ) || []
            )
          : []
    )
  )

module.exports = combineSubscribers
