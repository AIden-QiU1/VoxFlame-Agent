import assert from 'node:assert/strict'
import test from 'node:test'

import { fetchUploadRequest } from './upload-request'

test('a stalled upload request is aborted at its deadline', async () => {
  const requestSignals: AbortSignal[] = []

  const stalledRequest = async (
    _input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const requestSignal = init?.signal
    if (requestSignal) {
      requestSignals.push(requestSignal)
    }

    return await new Promise<Response>((_resolve, reject) => {
      requestSignal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'))
      }, { once: true })
    })
  }

  await assert.rejects(
    fetchUploadRequest('/api/upload/sign', { method: 'POST' }, 5, stalledRequest),
    (error: unknown) => error instanceof DOMException && error.name === 'AbortError',
  )
  assert.equal(requestSignals[0]?.aborted, true)
})

test('a completed upload request is returned unchanged', async () => {
  const expected = new Response(null, { status: 204 })
  const request = async (): Promise<Response> => expected

  const actual = await fetchUploadRequest(
    '/api/upload/complete',
    { method: 'POST' },
    20,
    request,
  )

  assert.equal(actual, expected)
})
