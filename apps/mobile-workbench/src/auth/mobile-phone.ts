const MAINLAND_MOBILE_PATTERN = /^1[3-9]\d{9}$/

export function normalizeMainlandPhone(input: string): string {
  const compact = input.trim().replace(/[\s()-]/g, '')
  let localNumber = compact

  if (compact.startsWith('+86')) {
    localNumber = compact.slice(3)
  } else if (compact.startsWith('0086')) {
    localNumber = compact.slice(4)
  } else if (compact.startsWith('86') && compact.length === 13) {
    localNumber = compact.slice(2)
  }

  if (!MAINLAND_MOBILE_PATTERN.test(localNumber)) {
    throw new Error('请输入正确的中国大陆手机号。')
  }

  return `+86${localNumber}`
}

export function displayMainlandPhone(phone: string): string {
  const localNumber = phone.startsWith('+86') ? phone.slice(3) : phone
  if (!MAINLAND_MOBILE_PATTERN.test(localNumber)) {
    return phone
  }
  return `${localNumber.slice(0, 3)} ${localNumber.slice(3, 7)} ${localNumber.slice(7)}`
}

export function shouldCreatePhoneUser(mode: 'login' | 'register'): boolean {
  return mode === 'register'
}
