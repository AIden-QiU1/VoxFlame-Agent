import type {
  MobilePreparedExpressionLibrary,
  MobileHotwordProfile,
  MobileSceneTemplate,
  MobileUserProfileMemory,
  MobileWorkspaceSnapshotContract,
} from '../contracts/workspace-read-model'
import type {
  MobileAuthTokenProvider,
  MobileWorkbenchClientOptions,
} from './mobile-workbench-client'

export interface MobileQuickPhrase {
  id: string
  user_id: string
  text: string
  category: string
  usage_count: number
  order_index: number
  updated_at?: string
}

export async function fetchMobileSceneTemplates(
  userId: string,
  options: MobileWorkbenchClientOptions,
): Promise<{ selectedIds: string[]; library: MobileSceneTemplate[] }> {
  const payload = await requestJson<{
    selected_template_ids: string[]
    library: MobileSceneTemplate[]
  }>(options, `/memory/workspace/${userId}/scene-templates`)
  return {
    selectedIds: payload.selected_template_ids,
    library: payload.library,
  }
}

export async function saveMobileSceneTemplates(
  userId: string,
  selectedTemplateIds: string[],
  options: MobileWorkbenchClientOptions,
): Promise<string[]> {
  const payload = await requestJson<{ selected_template_ids: string[] }>(
    options,
    `/memory/workspace/${userId}/scene-templates`,
    {
      method: 'PUT',
      body: JSON.stringify({ user_id: userId, selected_template_ids: selectedTemplateIds }),
    },
  )
  return payload.selected_template_ids
}

export async function saveMobileHotwordProfiles(
  userId: string,
  profiles: MobileHotwordProfile[],
  options: MobileWorkbenchClientOptions,
): Promise<MobileHotwordProfile[]> {
  const payload = await requestJson<{ profiles: MobileHotwordProfile[] }>(
    options,
    '/memory/hotwords',
    {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, profiles }),
    },
  )
  return payload.profiles
}

function buildApiUrl(apiBaseUrl: string, path: string): string {
  return `${apiBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

async function authHeaders(
  tokenProvider: MobileAuthTokenProvider,
): Promise<Record<string, string>> {
  const token = await tokenProvider.getAccessToken()
  if (!token) throw new Error('mobile_auth_required')
  return { Authorization: `Bearer ${token}` }
}

async function requestJson<T>(
  options: MobileWorkbenchClientOptions,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = await authHeaders(options.tokenProvider)
  const response = await fetch(buildApiUrl(options.apiBaseUrl, path), {
    ...init,
    headers: {
      ...headers,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  if (!response.ok) throw new Error(`mobile_memory_${response.status}`)
  return await response.json() as T
}

export async function fetchMobilePreparedExpressionLibrary(
  userId: string,
  options: MobileWorkbenchClientOptions,
): Promise<MobilePreparedExpressionLibrary> {
  const payload = await requestJson<{
    prepared_expression_library: MobilePreparedExpressionLibrary
  }>(options, `/memory/workspace/${userId}/prepared-expressions`)
  return payload.prepared_expression_library
}

export async function saveMobilePreparedExpression(
  userId: string,
  input: { id?: string; title: string; scene?: string | null; source?: string; content: string; make_active?: boolean },
  options: MobileWorkbenchClientOptions,
): Promise<MobilePreparedExpressionLibrary> {
  const payload = await requestJson<{
    prepared_expression_library: MobilePreparedExpressionLibrary
  }>(options, `/memory/workspace/${userId}/prepared-expressions`, {
    method: 'PUT',
    body: JSON.stringify({ user_id: userId, source: 'mobile_workbench', ...input }),
  })
  return payload.prepared_expression_library
}

export async function activateMobilePreparedExpression(
  userId: string,
  assetId: string,
  options: MobileWorkbenchClientOptions,
): Promise<{
  library: MobilePreparedExpressionLibrary
  workspaceSnapshot: MobileWorkspaceSnapshotContract
}> {
  const payload = await requestJson<{
    prepared_expression_library: MobilePreparedExpressionLibrary
    workspace_snapshot: MobileWorkspaceSnapshotContract
  }>(options, `/memory/workspace/${userId}/prepared-expressions/active`, {
    method: 'PUT',
    body: JSON.stringify({ user_id: userId, asset_id: assetId }),
  })
  return {
    library: payload.prepared_expression_library,
    workspaceSnapshot: payload.workspace_snapshot,
  }
}

export async function deleteMobilePreparedExpression(
  userId: string,
  assetId: string,
  options: MobileWorkbenchClientOptions,
): Promise<MobilePreparedExpressionLibrary> {
  const payload = await requestJson<{
    prepared_expression_library: MobilePreparedExpressionLibrary
  }>(options, `/memory/workspace/${userId}/prepared-expressions/${assetId}`, { method: 'DELETE' })
  return payload.prepared_expression_library
}

export async function saveMobileUserProfileMemory(
  userId: string,
  input: MobileUserProfileMemory,
  options: MobileWorkbenchClientOptions,
): Promise<MobileUserProfileMemory> {
  const payload = await requestJson<{
    user_profile_memory: MobileUserProfileMemory
  }>(options, `/memory/workspace/${userId}/profile-memory`, {
    method: 'PUT',
    body: JSON.stringify({ user_id: userId, ...input, replace_lists: true, replace_fields: true }),
  })
  return payload.user_profile_memory
}

export async function fetchMobileQuickPhrases(
  userId: string,
  options: MobileWorkbenchClientOptions,
): Promise<MobileQuickPhrase[]> {
  const payload = await requestJson<{ phrases: MobileQuickPhrase[] }>(
    options,
    `/phrases/user/${userId}`,
  )
  return payload.phrases
}

export async function createMobileQuickPhrase(
  userId: string,
  text: string,
  options: MobileWorkbenchClientOptions,
): Promise<MobileQuickPhrase> {
  return await requestJson<MobileQuickPhrase>(options, '/phrases', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, text, category: 'custom' }),
  })
}

export async function updateMobileQuickPhrase(
  phraseId: string,
  text: string,
  options: MobileWorkbenchClientOptions,
): Promise<MobileQuickPhrase> {
  return await requestJson<MobileQuickPhrase>(options, `/phrases/${phraseId}`, {
    method: 'PUT',
    body: JSON.stringify({ text }),
  })
}

export async function deleteMobileQuickPhrase(
  phraseId: string,
  options: MobileWorkbenchClientOptions,
): Promise<void> {
  await requestJson<{ success: boolean }>(options, `/phrases/${phraseId}`, { method: 'DELETE' })
}
