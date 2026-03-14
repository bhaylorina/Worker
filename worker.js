export default {
  async fetch(request) {
    const url = new URL(request.url);
    let targetUrlStr = request.url.substring(url.origin.length + 1);
    const DUCKDNS_DOMAIN = "sonyrip.duckdns.org"; 

    if (!targetUrlStr.startsWith("http")) {
      return new Response("Proxy Active! URL path me lagayein.", { status: 200 });
    }

    try {
      // 1. IP to Domain Swap (1003 Error rokne ke liye)
      let targetObj = new URL(targetUrlStr);
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(targetObj.hostname)) {
          targetObj.hostname = DUCKDNS_DOMAIN;
          targetUrlStr = targetObj.toString();
      }

      // 2. Fresh Headers (Bina Cloudflare ke nishaan ke)
      const newHeaders = new Headers();
      newHeaders.set("Host", targetObj.hostname);
      newHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
      newHeaders.set("Accept", "*/*");
      newHeaders.set("Connection", "keep-alive");

      // 3. Direct Fetch & Stream (No .text() parsing to save tokens and memory)
      const response = await fetch(targetUrlStr, {
        method: request.method,
        headers: newHeaders,
        redirect: 'manual' // Redirects ko hum handle karenge
      });

      // 4. Redirect Handle (Agar server naya temporary link de)
      if ([301, 302, 307, 308].includes(response.status)) {
        const location = response.headers.get("Location");
        if (location) {
          let locationUrl = new URL(location, targetUrlStr);
          // Redirect me IP aaye toh firse DuckDNS laga do
          if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(locationUrl.hostname)) {
              locationUrl.hostname = DUCKDNS_DOMAIN;
          }
          return new Response(null, {
            status: response.status,
            headers: { "Location": url.origin + "/" + locationUrl.toString(), "Access-Control-Allow-Origin": "*" }
          });
        }
      }

      // 5. Direct Body Streaming (Makhan jaisa chalega)
      const { readable, writable } = new TransformStream();
      response.body.pipeTo(writable);

      return new Response(readable, {
        status: response.status,
        headers: {
          ...Object.fromEntries(response.headers),
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache"
        }
      });

    } catch (e) {
      return new Response("Error: " + e.message, { status: 500 });
    }
  }
};
