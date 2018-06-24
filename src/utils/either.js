// @flow
'use strict'

export type EitherPattern<A, B, C: *> = {
  Error: A => C,
  Ok: B => C
}

type EitherType<A: *, B: *> = {
  map: <C: *>((B) => C) => EitherType<A, C>,
  fold: <C: *>((A) => C, (B) => C) => C,
  chain: <C: *>((B) => EitherType<A, C>) => EitherType<A, C>,
  match: <C: *>(EitherPattern<A, B, C>) => C
}

const sink = () => {}

const _match = <A, B, C>(
  either: EitherType<A, B>,
  patterns: EitherPattern<A, B, C>
): C => {
  return either.fold(patterns.Error || sink, patterns.Ok || sink)
}

const left = <T>(value: T): EitherType<T, *> => ({
  map(fn) {
    return this
  },
  fold(f, g) {
    return f(value)
  },
  chain(fn) {
    return this
  },
  match(patterns) {
    return _match(this, patterns)
  },
  value
})

const right = <T>(value: T): EitherType<*, T> => ({
  map(fn) {
    return right(fn(value))
  },
  fold(f, g) {
    return g(value)
  },
  chain(fn) {
    return fn(value)
  },
  match(patterns) {
    return _match(this, patterns)
  },
  value
})

const sequence = <A, B>(
  eitherList: EitherType<A, B | B[]>[]
): EitherType<A, B[]> => {
  return eitherList.reduce(
    (acc, either) => acc.chain(list => either.map(value => list.concat(value))),
    right([])
  )
}

const try_ = <T>(fn: () => T): EitherType<Error, T> => {
  try {
    return right(fn())
  } catch (e) {
    return left(e)
  }
}

const Either = {
  Left: left,
  Right: right
}

module.exports = {
  Either,
  sequence,
  try_
}
