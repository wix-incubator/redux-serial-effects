'use strict'

const isEffect = maybeEffect =>
  maybeEffect != null &&
  typeof maybeEffect.run === 'function' &&
  typeof maybeEffect.isQueued === 'boolean' &&
  (!maybeEffect.resultActionCreator ||
    typeof maybeEffect.resultActionCreator === 'function')

const isImmediateEffect = maybeEffect =>
  isEffect(maybeEffect) && !maybeEffect.isQueued

const isQueuedEffect = maybeEffect =>
  isEffect(maybeEffect) && maybeEffect.isQueued

module.exports = {
  isEffect,
  isImmediateEffect,
  isQueuedEffect
}
