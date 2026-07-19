#!/usr/bin/env node

const crypto = require('crypto')
const fs = require('fs')
const https = require('https')
const path = require('path')

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const equalsIndex = trimmed.indexOf('=')
    if (equalsIndex === -1) continue
    const key = trimmed.slice(0, equalsIndex).trim()
    const rawValue = trimmed.slice(equalsIndex + 1).trim()
    if (!key || process.env[key]) continue
    const quote = rawValue[0]
    const hasMatchingQuotes =
      (quote === '"' || quote === "'") && rawValue.endsWith(quote) && rawValue.length >= 2
    process.env[key] = hasMatchingQuotes ? rawValue.slice(1, -1) : rawValue
  }
}

loadDotEnvFile(path.resolve(process.cwd(), '.env.dnspod'))

const SECRET_ID =
  process.env.TENCENTCLOUD_SECRET_ID ||
  process.env.TENCENT_SECRET_ID ||
  process.env.DNSPOD_SECRET_ID
const SECRET_KEY =
  process.env.TENCENTCLOUD_SECRET_KEY ||
  process.env.TENCENT_SECRET_KEY ||
  process.env.DNSPOD_SECRET_KEY

function requireCredential(name, value) {
  if (!value) throw new Error(`Missing ${name}`)
}

function sha256(value, encoding = 'hex') {
  return crypto.createHash('sha256').update(value).digest(encoding)
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value).digest(encoding)
}

function formatDate(timestamp) {
  return new Date(timestamp * 1000).toISOString().slice(0, 10)
}

function readArg(name, fallback) {
  const prefix = `--${name}=`
  const item = process.argv.find((value) => value.startsWith(prefix))
  return item ? item.slice(prefix.length) : fallback
}

function post({ service, host, version, region, action, payload }) {
  requireCredential('TENCENTCLOUD_SECRET_ID', SECRET_ID)
  requireCredential('TENCENTCLOUD_SECRET_KEY', SECRET_KEY)

  const timestamp = Math.floor(Date.now() / 1000)
  const date = formatDate(timestamp)
  const body = JSON.stringify(payload)

  const canonicalRequest = [
    'POST',
    '/',
    '',
    `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`,
    'content-type;host;x-tc-action',
    sha256(body),
  ].join('\n')

  const credentialScope = `${date}/${service}/tc3_request`
  const stringToSign = [
    'TC3-HMAC-SHA256',
    timestamp,
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n')

  const secretDate = hmac(`TC3${SECRET_KEY}`, date)
  const secretService = hmac(secretDate, service)
  const secretSigning = hmac(secretService, 'tc3_request')
  const signature = hmac(secretSigning, stringToSign, 'hex')
  const authorization = [
    'TC3-HMAC-SHA256',
    `Credential=${SECRET_ID}/${credentialScope}`,
    'SignedHeaders=content-type;host;x-tc-action',
    `Signature=${signature}`,
  ].join(' ')

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        method: 'POST',
        host,
        path: '/',
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json; charset=utf-8',
          Host: host,
          'X-TC-Action': action,
          'X-TC-Region': region,
          'X-TC-Timestamp': String(timestamp),
          'X-TC-Version': version,
        },
      },
      (response) => {
        let responseBody = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => { responseBody += chunk })
        response.on('end', () => {
          try {
            resolve(JSON.parse(responseBody))
          } catch {
            reject(new Error(`Failed to parse response: ${responseBody}`))
          }
        })
      },
    )
    request.on('error', reject)
    request.write(body)
    request.end()
  })
}

async function main() {
  const service = readArg('service', '')
  const action = readArg('action', '')
  const version = readArg('version', '')
  const region = readArg('region', 'ap-guangzhou')
  const payload = JSON.parse(readArg('payload', '{}'))
  const host = readArg('host', service ? `${service}.tencentcloudapi.com` : '')

  if (!service || !action || !version || !host) {
    throw new Error('Usage: node scripts/ops/tencentcloud_api_probe.cjs --service=dnspod --host=dnspod.tencentcloudapi.com --version=2021-03-23 --action=DescribeRecordList --payload={}')
  }

  const response = await post({ service, host, version, region, action, payload })
  console.log(JSON.stringify(response, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
