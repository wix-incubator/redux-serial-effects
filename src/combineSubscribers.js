'use strict'

const { flatten } = require('./utils/flatten')

const combineSubscribers = subscriberMap => (
  transition,
  dispatch,
  extraArgument
) =>
  Promise.all(
    Object.keys(subscriberMap).map(
      key =>
        transition.from[key] !== transition.to[key] && subscriberMap[key]
          ? subscriberMap[key](
              {
                from: transition.from[key],
                to: transition.to[key]
              },
              dispatch,
              extraArgument
            )
          : Promise.resolve()
    )
  ).then(flatten)

module.exports = combineSubscribers

// vim: set ts=2 sw=2 tw=80 et :
