import type { User } from '@supabase/supabase-js'

export const LEGAL_CONSENT_VERSION = '2026-03-28'

const LOCAL_STORAGE_KEY = 'voxflame_legal_consent'

export interface LegalConsentSnapshot {
  privacyAccepted: boolean
  dataCollectionAccepted: boolean
  acceptedAt: string
  version: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  return record[key] === true
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function buildLegalConsentSnapshot(): LegalConsentSnapshot {
  return {
    privacyAccepted: true,
    dataCollectionAccepted: true,
    acceptedAt: new Date().toISOString(),
    version: LEGAL_CONSENT_VERSION,
  }
}

export function buildLegalConsentUserData(snapshot: LegalConsentSnapshot): Record<string, unknown> {
  return {
    legal_consent: {
      privacy_accepted: snapshot.privacyAccepted,
      data_collection_accepted: snapshot.dataCollectionAccepted,
      accepted_at: snapshot.acceptedAt,
      version: snapshot.version,
    },
  }
}

export function persistLocalLegalConsent(snapshot: LegalConsentSnapshot): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(snapshot))
}

export function readLocalLegalConsent(): LegalConsentSnapshot | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) {
      return null
    }

    return {
      privacyAccepted: readBoolean(parsed, 'privacyAccepted'),
      dataCollectionAccepted: readBoolean(parsed, 'dataCollectionAccepted'),
      acceptedAt: readString(parsed, 'acceptedAt') ?? '',
      version: readString(parsed, 'version') ?? '',
    }
  } catch {
    return null
  }
}

export function readUserLegalConsent(user: User | null | undefined): LegalConsentSnapshot | null {
  const metadata = isRecord(user?.user_metadata) ? user.user_metadata : null
  const legalConsent = metadata && isRecord(metadata.legal_consent)
    ? metadata.legal_consent
    : null

  if (!legalConsent) {
    return null
  }

  return {
    privacyAccepted: readBoolean(legalConsent, 'privacy_accepted'),
    dataCollectionAccepted: readBoolean(legalConsent, 'data_collection_accepted'),
    acceptedAt: readString(legalConsent, 'accepted_at') ?? '',
    version: readString(legalConsent, 'version') ?? '',
  }
}

export function hasRequiredLegalConsent(user: User | null | undefined): boolean {
  const userConsent = readUserLegalConsent(user)
  if (userConsent?.privacyAccepted && userConsent.dataCollectionAccepted) {
    return true
  }

  const localConsent = readLocalLegalConsent()
  return Boolean(localConsent?.privacyAccepted && localConsent.dataCollectionAccepted)
}
