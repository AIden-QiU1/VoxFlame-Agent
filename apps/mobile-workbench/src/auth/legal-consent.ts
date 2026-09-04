export const MOBILE_LEGAL_CONSENT_VERSION = '2026-09-03'

export interface MobileLegalConsentMetadata {
  legal_consent: {
    privacy_accepted: true
    sensitive_data_accepted: true
    data_collection_accepted: true
    commercial_use_accepted: true
    accepted_at: string
    version: string
  }
}

export function buildMobileLegalConsentMetadata(): MobileLegalConsentMetadata {
  return {
    legal_consent: {
      privacy_accepted: true,
      sensitive_data_accepted: true,
      data_collection_accepted: true,
      commercial_use_accepted: true,
      accepted_at: new Date().toISOString(),
      version: MOBILE_LEGAL_CONSENT_VERSION,
    },
  }
}
