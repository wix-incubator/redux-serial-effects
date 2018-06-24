// @flow
'use strict'

type Selector = Object => *

export type Transition = {
  from: {},
  to: {},
  hasChanged: Selector => boolean,
  hasChangedToMatch: (Selector, (Object) => boolean) => boolean,
  hasChangedToTrue: Selector => boolean,
  hasChangedToFalse: Selector => boolean,
  hasChangedToNull: Selector => boolean,
  hasChangedToNotNull: Selector => boolean
}

module.exports = (from: {}, to: {}) => {
  const transition: Transition = {
    from,
    to,
    hasChanged: selector => selector(from) !== selector(to),
    hasChangedToMatch: (selector, predicate) =>
      transition.hasChanged(selector) && predicate(selector(to)),
    hasChangedToTrue: selector =>
      transition.hasChangedToMatch(selector, _ => _ === true),
    hasChangedToFalse: selector =>
      transition.hasChangedToMatch(selector, _ => _ === false),
    hasChangedToNull: selector =>
      transition.hasChangedToMatch(selector, _ => _ === null),
    hasChangedToNotNull: selector =>
      transition.hasChangedToMatch(selector, _ => _ !== null)
  }

  return transition
}
