#!/usr/bin/env bash
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"
: "${CLOUDFLARE_ZONE_ID:?CLOUDFLARE_ZONE_ID is required}"
: "${DUTY_SERVER_IP:?DUTY_SERVER_IP is required}"

record_name="${DUTY_RECORD_NAME:-duty.manic.kr}"
proxied="${DUTY_CLOUDFLARE_PROXIED:-false}"

record_id="$(
  curl -sS -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records?type=A&name=${record_name}" |
    node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(j.result?.[0]?.id||'')})"
)"

payload="$(node -e "console.log(JSON.stringify({type:'A',name:process.env.DUTY_RECORD_NAME||'duty.manic.kr',content:process.env.DUTY_SERVER_IP,ttl:1,proxied:(process.env.DUTY_CLOUDFLARE_PROXIED||'false')==='true'}))")"

if [[ -n "${record_id}" ]]; then
  curl -sS -X PUT "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${record_id}" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "${payload}"
else
  curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "${payload}"
fi
