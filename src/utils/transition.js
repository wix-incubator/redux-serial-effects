'use strict'

module.exports = (from, to) => {
  const transition = {
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
