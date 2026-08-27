import type { MobileHotwordProfile } from '../contracts/workspace-read-model'

export function upsertMobileHotwordProfile(
  profiles: MobileHotwordProfile[],
  input: {
    id?: string
    phrase: string
    category: MobileHotwordProfile['category']
    scenario: string
    note?: string
  },
  now = Date.now(),
): MobileHotwordProfile[] {
  const phrase = input.phrase.trim()
  if (!phrase) return profiles

  const existing = input.id ? profiles.find((profile) => profile.id === input.id) : undefined
  const next: MobileHotwordProfile = {
    id: existing?.id ?? `mobile-hotword-${now}-${Math.random().toString(36).slice(2, 8)}`,
    phrase,
    category: input.category,
    scenario: input.scenario.trim(),
    note: input.note?.trim() || undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  return [next, ...profiles.filter((profile) => profile.id !== next.id)]
}

export function removeMobileHotwordProfile(
  profiles: MobileHotwordProfile[],
  profileId: string,
): MobileHotwordProfile[] {
  return profiles.filter((profile) => profile.id !== profileId)
}
