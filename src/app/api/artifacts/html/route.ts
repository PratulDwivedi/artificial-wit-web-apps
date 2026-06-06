import { NextRequest, NextResponse } from 'next/server'
import { getMcpCredentials } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('aw_token')?.value
  if (!token) return new NextResponse('Unauthorized', { status: 401 })

  const creds = await getMcpCredentials(token)
  if (!creds.ok) return new NextResponse(creds.error, { status: creds.status })

  const { apiKey, mcpUrl } = creds
  const mcpBase = mcpUrl.trim().replace(/\/$/, '')

  const targetUrl = request.nextUrl.searchParams.get('url')
  if (!targetUrl) return new NextResponse('Missing ?url parameter', { status: 400 })

  let decoded: string
  try { decoded = decodeURIComponent(targetUrl) }
  catch { return new NextResponse('Invalid ?url parameter', { status: 400 }) }

  const artifactBase = (process.env.AW_APP_BASE_URL ?? '').replace(/\/$/, '')
  const isMcpUrl      = decoded.startsWith(mcpBase)
  const isArtifactUrl = artifactBase !== '' && decoded.startsWith(artifactBase)

  if (!isMcpUrl && !isArtifactUrl) {
    return new NextResponse(
      `URL not allowed.\nDecoded: ${decoded}\nAllowed prefixes: ${mcpBase} | ${artifactBase}`,
      { status: 403 }
    )
  }

  let upstream: Response
  try {
    upstream = await fetch(decoded, {
      headers: {
        ...(isMcpUrl ? { 'x-api-key': apiKey } : {}),
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15_000),
      cache:  'no-store',
    })
  } catch (err) {
    return new NextResponse(`Upstream fetch failed: ${(err as Error).message}`, { status: 502 })
  }

  if (!upstream.ok) {
    let detail = ''
    try { detail = await upstream.text() } catch { /* ignore */ }
    return new NextResponse(`Upstream returned HTTP ${upstream.status}\nURL: ${decoded}\nDetail: ${detail}`, { status: upstream.status })
  }

  const contentType = upstream.headers.get('content-type') ?? 'text/html'
  if (!contentType.includes('text/html')) {
    const body = await upstream.arrayBuffer()
    return new NextResponse(body, { status: upstream.status, headers: { 'content-type': contentType } })
  }

  let html = await upstream.text()

  const artifactOrigin = (() => { try { return new URL(decoded).origin } catch { return mcpBase } })()
  const baseTag = `<base href="${artifactOrigin}/">`

  const coworkShim = `<script>
(function () {
  'use strict';
  var _id = 0;
  var _pending = {};
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (d && d.type === 'mcp:result' && _pending[d.requestId]) {
      var p = _pending[d.requestId];
      delete _pending[d.requestId];
      p.resolve(d.result);
    }
  });
  window.cowork = {
    callMcpTool: function (tool, args) {
      return new Promise(function (resolve, reject) {
        var requestId = 'wcw_' + (++_id) + '_' + Date.now();
        _pending[requestId] = { resolve: resolve, reject: reject };
        window.parent.postMessage(
          { type: 'mcp:call', tool: tool, args: args, requestId: requestId },
          window.location.origin
        );
        setTimeout(function () {
          if (_pending[requestId]) {
            delete _pending[requestId];
            reject(new Error('MCP call timed out: ' + tool));
          }
        }, 30000);
      });
    },
  };
})();
</script>`

  const injection   = `${baseTag}\n  ${coworkShim}`
  const headOpen    = /<head(\s[^>]*)?>/
  const htmlOpen    = /<html(\s[^>]*)?>/

  if (headOpen.test(html)) {
    html = html.replace(headOpen, (match) => `${match}\n  ${injection}`)
  } else if (htmlOpen.test(html)) {
    html = html.replace(htmlOpen, (match) => `${match}\n<head>${injection}</head>`)
  } else {
    html = `<head>${injection}</head>\n${html}`
  }

  return new NextResponse(html, {
    status: 200,
    headers: {
      'content-type':    'text/html; charset=utf-8',
      'cache-control':   'no-store',
      'x-frame-options': 'SAMEORIGIN',
    },
  })
}
