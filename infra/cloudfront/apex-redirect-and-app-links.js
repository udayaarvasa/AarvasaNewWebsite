
function handler(event) {
  var req = event.request;
  // Keep this public statement in sync with public/.well-known/assetlinks.json.
  // Android requires a direct JSON response, including on the bare host.
  var host = req.headers.host && req.headers.host.value;
  if ((host === "www.aarvasa.com" || host === "aarvasa.com") &&
      req.uri === "/.well-known/assetlinks.json" &&
      (req.method === "GET" || req.method === "HEAD")) {
    return {
      statusCode: 200,
      statusDescription: "OK",
      headers: {
        "content-type": { value: "application/json" },
        "cache-control": { value: "public, max-age=300" },
        "x-content-type-options": { value: "nosniff" }
      },
      body: req.method === "HEAD" ? "" : "[{\"relation\":[\"delegate_permission/common.handle_all_urls\"],\"target\":{\"namespace\":\"android_app\",\"package_name\":\"com.aarvasa.app\",\"sha256_cert_fingerprints\":[\"68:F8:DD:FE:A0:96:F1:85:64:17:B8:7F:7C:70:F6:F0:06:CD:98:CA:09:4B:B7:12:7A:13:47:2C:67:F5:F9:8B\"]}}]"
    };
  }

  if (req.headers.host && req.headers.host.value === "aarvasa.com") {
    var qs = [];
    for (var k in req.querystring) {
      var v = req.querystring[k];
      if (v.multiValue) { for (var i = 0; i < v.multiValue.length; i++) qs.push(k + "=" + v.multiValue[i].value); }
      else qs.push(v.value === "" ? k : k + "=" + v.value);
    }
    return { statusCode: 301, statusDescription: "Moved Permanently",
      headers: { location: { value: "https://www.aarvasa.com" + req.uri + (qs.length ? "?" + qs.join("&") : "") } } };
  }
  return req;
}
