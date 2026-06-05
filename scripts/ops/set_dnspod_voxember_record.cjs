#!/usr/bin/env node

const crypto = require('crypto')
const fs = require('fs')
const https = require('https')
const path = require('path')

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return
  }

  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const equalsIndex = trimmed.indexOf('=')
    if (equalsIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, equalsIndex).trim()
    const rawValue = trimmed.slice(equalsIndex + 1).trim()
    if (!key || process.env[key]) {
      continue
    }

    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '')
  }
}

loadDotEnvFile(path.resolve(process.cwd(), '.env.dnspod'))

const DOMAIN = process.env.DNSPOD_DOMAIN || 'voxember.com'
const SUB_DOMAIN = process.env.DNSPOD_SUB_DOMAIN || '@'
const RECORD_TYPE = process.env.DNSPOD_RECORD_TYPE || 'A'
const RECORD_LINE = process.env.DNSPOD_RECORD_LINE || '默认'
const RECORD_VALUE = process.env.DNSPOD_RECORD_VALUE || '111.230.35.89'
const TTL = Number(process.env.DNSPOD_TTL || '600')

const SECRET_ID =
  process.env.TENCENTCLOUD_SECRET_ID ||
  process.env.TENCENT_SECRET_ID ||
  process.env.DNSPOD_SECRET_ID
const SECRET_KEY =
  process.env.TENCENTCLOUD_SECRET_KEY ||
  process.env.TENCENT_SECRET_KEY ||
  process.env.DNSPOD_SECRET_KEY

const HOST = 'dnspod.tencentcloudapi.com'
const SERVICE = 'dnspod'
const VERSION = '2021-03-23'
const REGION = 'ap-guangzhou'

function requireCredential(name, value) {
  if (!value) {
    throw new Error(`Missing ${name}. Export a temporary Tencent Cloud CAM key before running this script.`)
  }
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

function post(action, payload) {
  requireCredential('TENCENTCLOUD_SECRET_ID', SECRET_ID)
  requireCredential('TENCENTCLOUD_SECRET_KEY', SECRET_KEY)

  const timestamp = Math.floor(Date.now() / 1000)
  const date = formatDate(timestamp)
  const body = JSON.stringify(payload)

  const canonicalRequest = [
    'POST',
    '/',
    '',
    `content-type:application/json; charset=utf-8\nhost:${HOST}\nx-tc-action:${action.toLowerCase()}\n`,
    'content-type;host;x-tc-action',
    sha256(body),
  ].join('\n')

  const credentialScope = `${date}/${SERVICE}/tc3_request`
  const stringToSign = [
    'TC3-HMAC-SHA256',
    timestamp,
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n')

  const secretDate = hmac(`TC3${SECRET_KEY}`, date)
  const secretService = hmac(secretDate, SERVICE)
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
        host: HOST,
        path: '/',
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json; charset=utf-8',
          Host: HOST,
          'X-TC-Action': action,
          'X-TC-Region': REGION,
          'X-TC-Timestamp': String(timestamp),
          'X-TC-Version': VERSION,
        },
      },
      (response) => {
        let responseBody = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => {
          responseBody += chunk
        })
        response.on('end', () => {
          let parsed
          try {
            parsed = JSON.parse(responseBody)
          } catch (error) {
            reject(new Error(`Failed to parse Tencent Cloud response: ${responseBody}`))
            return
          }

          if (
            action === 'DescribeRecordList' &&
            parsed.Response?.Error?.Code === 'ResourceNotFound.NoDataOfRecord'
          ) {
            resolve({ RecordList: [] })
            return
          }

          if (parsed.Response?.Error) {
            reject(new Error(`${parsed.Response.Error.Code}: ${parsed.Response.Error.Message}`))
            return
          }

          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`HTTP ${response.statusCode}: ${responseBody}`))
            return
          }

          resolve(parsed.Response)
        })
      },
    )

    request.on('error', reject)
    request.write(body)
    request.end()
  })
}

async function main() {
  console.log(`Checking DNSPod record: ${SUB_DOMAIN}.${DOMAIN} ${RECORD_TYPE} -> ${RECORD_VALUE}`)

  const listResponse = await post('DescribeRecordList', {
    Domain: DOMAIN,
    Subdomain: SUB_DOMAIN,
    RecordType: RECORD_TYPE,
  })

  const existingRecords = listResponse.RecordList || []
  const targetRecord = existingRecords.find((record) => record.Type === RECORD_TYPE)

  if (!targetRecord) {
    const createResponse = await post('CreateRecord', {
      Domain: DOMAIN,
      SubDomain: SUB_DOMAIN,
      RecordType: RECORD_TYPE,
      RecordLine: RECORD_LINE,
      Value: RECORD_VALUE,
      TTL,
    })
    console.log(`Created ${DOMAIN} ${SUB_DOMAIN} ${RECORD_TYPE} record, id=${createResponse.RecordId}`)
    return
  }

  if (
    targetRecord.Value === RECORD_VALUE &&
    targetRecord.Line === RECORD_LINE &&
    Number(targetRecord.TTL) === TTL
  ) {
    console.log(`Record already correct, id=${targetRecord.RecordId}`)
    return
  }

  await post('ModifyRecord', {
    Domain: DOMAIN,
    RecordId: targetRecord.RecordId,
    SubDomain: SUB_DOMAIN,
    RecordType: RECORD_TYPE,
    RecordLine: RECORD_LINE,
    Value: RECORD_VALUE,
    TTL,
  })
  console.log(
    `Updated record id=${targetRecord.RecordId}: ${targetRecord.Value} -> ${RECORD_VALUE}`,
  )
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
