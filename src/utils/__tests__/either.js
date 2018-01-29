'use strict'

const { Either, sequence, try_ } = require('../either')

const id = _ => _

describe('either', function() {
  describe('left', function() {
    test('should not chain', function() {
      const left = Either.Left()
      expect(left.chain(() => 1)).toBe(left)
    })

    test('should not map', function() {
      const left = Either.Left()
      expect(left.map(() => 1)).toBe(left)
    })

    test('should fold correctly', function() {
      const left = Either.Left()
      expect(left.fold(() => 'left', () => 'right')).toBe('left')
    })

    describe('pattern match', function() {
      test('should match "Error"', function() {
        const left = Either.Left()
        expect(left.match({ Error: () => 'left', Ok: () => 'right' })).toBe(
          'left'
        )
      })

      test('should default to an empty function if "Error" pattern is not given', function() {
        const left = Either.Left()
        expect(left.match({ Ok: () => 'right' })).toBeUndefined()
      })
    })
  })

  describe('right', function() {
    test('should chain', function() {
      const right = Either.Right()
      expect(right.chain(() => 1)).not.toBe(right)
    })

    test('should map', function() {
      const right = Either.Right()
      expect(right.map(() => 1)).not.toBe(right)
    })

    test('should fold correctly', function() {
      const right = Either.Right()
      expect(right.fold(() => 'left', () => 'right')).toBe('right')
    })

    describe('pattern match', function() {
      test('should match "Ok"', function() {
        const right = Either.Right()
        expect(right.match({ Error: () => 'left', Ok: () => 'right' })).toBe(
          'right'
        )
      })

      test('should default to an empty function if "Ok" pattern is not given', function() {
        const right = Either.Right()
        expect(right.match({ Error: () => 'left' })).toBeUndefined()
      })
    })
  })

  describe('sequence', function() {
    test('should return left if at least one element is left', function() {
      const list = [Either.Right(1), Either.Left(2), Either.Right(3)]
      expect(sequence(list).fold(id, () => {})).toBe(2)
    })

    test('should return right if all elements are rights', function() {
      const list = [Either.Right(1), Either.Right(2), Either.Right(3)]
      expect(sequence(list).fold(() => {}, id)).toEqual([1, 2, 3])
    })
  })

  describe('try_', function() {
    test('should return left if callback throws an exception', function() {
      const errorText = 'hardcoded exception'
      const either = try_(() => {
        throw new Error(errorText)
      })
      expect(either.fold(error => error.message, () => {})).toEqual(errorText)
    })

    test('should return right if callback does not throw an exception', function() {
      const value = 42
      const either = try_(() => {
        return value
      })
      expect(either.fold(() => {}, id)).toEqual(value)
    })
  })
})
