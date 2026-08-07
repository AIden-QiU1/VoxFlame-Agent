import assert from 'node:assert/strict'
import test from 'node:test'
import {
  displayMainlandPhone,
  normalizeMainlandPhone,
  shouldCreatePhoneUser,
} from './phone.ts'

test('normalizeMainlandPhone accepts common mainland formats', () => {
  assert.equal(normalizeMainlandPhone('13812345678'), '+8613812345678')
  assert.equal(normalizeMainlandPhone('+86 138 1234 5678'), '+8613812345678')
  assert.equal(normalizeMainlandPhone('0086-138-1234-5678'), '+8613812345678')
  assert.equal(normalizeMainlandPhone('8613812345678'), '+8613812345678')
})

test('normalizeMainlandPhone rejects unsupported or malformed numbers', () => {
  assert.throws(() => normalizeMainlandPhone('12812345678'))
  assert.throws(() => normalizeMainlandPhone('+85251234567'))
  assert.throws(() => normalizeMainlandPhone('1381234567'))
})

test('displayMainlandPhone formats a normalized number for people', () => {
  assert.equal(displayMainlandPhone('+8613812345678'), '138 1234 5678')
})

test('phone login never creates users while phone registration can', () => {
  assert.equal(shouldCreatePhoneUser('login'), false)
  assert.equal(shouldCreatePhoneUser('register'), true)
})
