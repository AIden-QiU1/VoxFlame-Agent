import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDir, '..')
const repoRoot = path.resolve(appRoot, '../..')

function parseEnvFile(filePath) {
  const values = {}
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match) {
      continue
    }

    values[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }

  return values
}

function requireValue(value, name) {
  if (!value || !String(value).trim()) {
    throw new Error(`missing_${name}`)
  }

  return String(value).trim()
}

async function main() {
  const backendEnv = parseEnvFile(path.join(repoRoot, 'backend/.env'))
  const supabaseUrl = requireValue(
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? backendEnv.SUPABASE_URL,
    'supabase_url',
  )
  const supabaseAnonKey = requireValue(
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? backendEnv.SUPABASE_ANON_KEY,
    'supabase_anon_key',
  )
  const apiBaseUrl = requireValue(
    process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3001/api',
    'api_base_url',
  ).replace(/\/$/, '')
  const email = requireValue(
    process.env.MOBILE_WORKBENCH_SMOKE_EMAIL,
    'MOBILE_WORKBENCH_SMOKE_EMAIL',
  )
  const password = requireValue(
    process.env.MOBILE_WORKBENCH_SMOKE_PASSWORD,
    'MOBILE_WORKBENCH_SMOKE_PASSWORD',
  )

  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw new Error(`sign_in_failed:${error.message}`)
  }

  const session = data.session
  const user = data.user
  if (!session || !user) {
    throw new Error('sign_in_missing_session')
  }

  const workspaceResponse = await fetch(`${apiBaseUrl}/memory/workspace/${user.id}`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  if (!workspaceResponse.ok) {
    throw new Error(`workspace_snapshot_${workspaceResponse.status}`)
  }

  const snapshot = await workspaceResponse.json()
  const quickPhrases = snapshot.expression_kit?.quick_phrases
  const result = {
    email: user.email,
    userId: user.id,
    workspaceStatus: workspaceResponse.status,
    hasPreparedExpression: Boolean(snapshot.prepared_expression),
    quickPhraseCount: Array.isArray(quickPhrases) ? quickPhrases.length : 0,
    dailyTarget: snapshot.training_activity?.daily_target_count ?? null,
    syncedAt: snapshot.synced_at ?? null,
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
