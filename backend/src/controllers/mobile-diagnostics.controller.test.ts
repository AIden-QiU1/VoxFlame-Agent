import assert from 'node:assert/strict'

import { sanitizeMobileDiagnosticBatch } from './mobile-diagnostics.controller'

const receivedAt = '2026-07-26T08:00:00.000Z'
const validReport = {
  reportId: 'report-12345678',
  installationId: 'install-12345678',
  occurredAt: '2026-07-26T07:59:00.000Z',
  appVersion: '0.1.1',
  buildVersion: '2',
  platform: 'android',
  osVersion: '35',
  deviceModel: 'Pixel 8',
  kind: 'api_failure',
  severity: 'error',
  code: 'workspace_snapshot_503',
  surface: 'memory',
  phase: 'workspace_refresh',
  endpoint: '/memory/workspace/current?token=secret&email=user@example.com',
  httpStatus: 503,
  stack: 'Error: user@example.com\n at fetch (?token=secret)\nBearer abc.def.ghi',
  breadcrumbs: [
    {
      at: '2026-07-26T07:58:59.000Z',
      category: 'navigation',
      action: 'open_surface',
      status: 'memory',
      ignoredText: 'must never be stored',
    },
  ],
  transcript: 'private speech must never be stored',
  token: 'private token must never be stored',
}

const sanitized = sanitizeMobileDiagnosticBatch(
  { reports: [validReport] },
  '64758dee-5026-4b53-a063-1d02d0834f67',
  receivedAt,
)

assert.equal(sanitized.length, 1)
assert.equal(sanitized[0].receivedAt, receivedAt)
assert.equal(sanitized[0].endpoint, '/memory/workspace/current')
assert.equal(sanitized[0].httpStatus, 503)
assert.equal(sanitized[0].breadcrumbs.length, 1)
assert.ok(!JSON.stringify(sanitized[0]).includes('private speech'))
assert.ok(!JSON.stringify(sanitized[0]).includes('private token'))
assert.ok(!JSON.stringify(sanitized[0]).includes('user@example.com'))
assert.ok(!JSON.stringify(sanitized[0]).includes('abc.def.ghi'))
assert.ok(sanitized[0].stack?.includes('<redacted-email>'))
assert.ok(sanitized[0].stack?.includes('Bearer <redacted>'))

assert.deepEqual(
  sanitizeMobileDiagnosticBatch({ reports: [{ ...validReport, reportId: '../bad' }] }, 'user'),
  [],
)
assert.deepEqual(sanitizeMobileDiagnosticBatch({ reports: [] }, 'user'), [])
assert.deepEqual(sanitizeMobileDiagnosticBatch({ reports: 'invalid' }, 'user'), [])

console.log('mobile diagnostics controller tests passed')
