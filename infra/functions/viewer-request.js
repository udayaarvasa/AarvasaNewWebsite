// CloudFront Function (JavaScript runtime 2.0), viewer-request event.
//
// This file is a template. The quoted __PLACEHOLDER__ strings are replaced at
// synth time by src/edge-function.ts from src/config.ts and src/media-contract.ts,
// so the edge rules can never drift from the storage layout.
//
// Viewer-request functions run for every request, unlike viewer-response
// functions, which CloudFront skips when the origin returns 4xx/5xx. So this
// function owns request filtering and CORS preflight. CORS and security headers
// on normal responses come from the distribution's response headers policy,
// which applies to every response including errors.

var ALLOWED_ORIGINS = JSON.parse('__ALLOWED_ORIGINS_JSON__');
var MEDIA_KEY = new RegExp(JSON.parse('__MEDIA_KEY_PATTERN_JSON__'));
var LIB_KEY = new RegExp(JSON.parse('__LIB_KEY_PATTERN_JSON__'));
var MEDIA_EXTENSIONS = JSON.parse('__MEDIA_EXTENSIONS_JSON__');
var LIB_EXTENSIONS = JSON.parse('__LIB_EXTENSIONS_JSON__');
var PREFLIGHT_MAX_AGE_SECONDS = '86400';

function header(headers, name) {
  var h = headers[name];
  return h ? h.value : undefined;
}

function extensionOf(key) {
  var name = key.slice(key.lastIndexOf('/') + 1);
  var dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function deny(statusCode, statusDescription) {
  return {
    statusCode: statusCode,
    statusDescription: statusDescription,
    headers: {
      'cache-control': { value: 'no-store' },
      'x-content-type-options': { value: 'nosniff' },
    },
  };
}

function isServableKey(key) {
  var ext = extensionOf(key);
  if (MEDIA_KEY.test(key)) return MEDIA_EXTENSIONS.indexOf(ext) !== -1;
  if (LIB_KEY.test(key)) return LIB_EXTENSIONS.indexOf(ext) !== -1;
  return false;
}

// CloudFront invokes this top-level function by name.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function handler(event) {
  var request = event.request;
  var method = request.method;

  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    return deny(405, 'Method Not Allowed');
  }

  // Only content-addressed media and versioned decoder paths exist on this CDN.
  // Everything else, including originals/, is refused before reaching S3.
  var key = request.uri.charAt(0) === '/' ? request.uri.slice(1) : request.uri;
  if (!isServableKey(key)) {
    return deny(404, 'Not Found');
  }

  if (method === 'OPTIONS') {
    var origin = header(request.headers, 'origin');
    var requestedMethod = header(request.headers, 'access-control-request-method');
    if (!origin || ALLOWED_ORIGINS.indexOf(origin) === -1) {
      return deny(403, 'Forbidden');
    }
    if (requestedMethod !== 'GET' && requestedMethod !== 'HEAD') {
      return deny(403, 'Forbidden');
    }
    return {
      statusCode: 204,
      statusDescription: 'No Content',
      headers: {
        'access-control-allow-origin': { value: origin },
        'access-control-allow-methods': { value: 'GET, HEAD' },
        'access-control-allow-headers': { value: 'Range' },
        'access-control-max-age': { value: PREFLIGHT_MAX_AGE_SECONDS },
        'vary': { value: 'Origin' },
      },
    };
  }

  // Assets are addressed purely by path. Query strings and cookies (including
  // any NextAuth cookie a browser might send) never reach the cache key or S3.
  request.querystring = {};
  request.cookies = {};
  return request;
}
