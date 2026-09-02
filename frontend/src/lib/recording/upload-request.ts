export const UPLOAD_REQUEST_TIMEOUT_MS = 20_000

type FetchRequest = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

/** Bounds each upload step so a stalled request can fall back to the recorder queue. */
export async function fetchUploadRequest(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number = UPLOAD_REQUEST_TIMEOUT_MS,
  request: FetchRequest = fetch,
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await request(input, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
}
