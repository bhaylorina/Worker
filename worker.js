export default {
  async fetch(request) {
    const url = new URL(request.url);
    let targetUrlStr = request.url.substring(url.origin.length + 1);

    const DUCKDNS_DOMAIN = "sonyrip.duckdns.org"; 

    if (!targetUrlStr || (!targetUrlStr.startsWith("http://") && !targetUrlStr.startsWith("https://"))) {
      return new Response("Doctor sahab ka Universal Proxy! \nKripya URL ko path mein lagayein.", { status: 200 });
    }

    // --- BRAMHASTRA 5: GLOBAL IP REPLACER ---
    // Agar input URL mein hi direct IP hai, toh use fetch hone se pehle hi DuckDNS se badal do
    try {
        let initialUrl = new URL(targetUrlStr);
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(initialUrl.hostname)) {
            initialUrl.hostname = DUCKDNS_DOMAIN;
            targetUrlStr = initialUrl.toString();
        }
    } catch(e) {}

    console.log(`[START] Request aayi hai. Target hai: ${targetUrlStr}`);

    try {
      const targetObj = new URL(targetUrlStr);
      const reqHeaders = new Headers(request.headers);
      
      reqHeaders.set("Host", targetObj.hostname);
      reqHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
      reqHeaders.set("Accept", "*/*");
      reqHeaders.set("Connection", "keep-alive");
      reqHeaders.set("Referer", targetObj.origin + "/");
      reqHeaders.set("Origin", targetObj.origin);
      
      reqHeaders.delete("CF-Connecting-IP");
      reqHeaders.delete("CF-Ray");
      reqHeaders.delete("X-Forwarded-For");
      reqHeaders.delete("X-Real-IP");

      const fetchOptions = {
        method: request.method,
        headers: reqHeaders,
        redirect: 'manual' 
      };

      console.log(`[FETCH] DuckDNS ke through Target ko request bhej rahe hain...`);
      const response = await fetch(targetUrlStr, fetchOptions);
      console.log(`[RESPONSE] Server Status: ${response.status}`);

      // --- REDIRECT HANDLER ---
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("Location");
        if (location) {
          let locationUrl = new URL(location, targetUrlStr);
          
          if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(locationUrl.hostname)) {
              locationUrl.hostname = DUCKDNS_DOMAIN;
          }

          const proxiedLocation = url.origin + "/" + locationUrl.toString();
          console.log(`[REDIRECT] Proxied Link: ${proxiedLocation}`);
          
          const resHeaders = new Headers(response.headers);
          resHeaders.set("Location", proxiedLocation);
          resHeaders.set("Access-Control-Allow-Origin", "*");
          
          return new Response(null, {
            status: response.status,
            statusText: response.statusText,
            headers: resHeaders
          });
        }
      }

      // --- M3U8 REWRITER ---
      const contentType = response.headers.get("Content-Type") || "";
      if (contentType.toLowerCase().includes("mpegurl") || targetUrlStr.toLowerCase().includes(".m3u8")) {
        console.log(`[M3U8] Playlist mil gayi, IPs ko DuckDNS me badal rahe hain...`);
        const m3u8Text = await response.text();
        
        const rewrittenText = m3u8Text.split('\n').map(line => {
          const trimmedLine = line.trim();
          if (trimmedLine && !trimmedLine.startsWith("#")) {
            let chunkUrl = new URL(trimmedLine, targetUrlStr);
            if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(chunkUrl.hostname)) {
                chunkUrl.hostname = DUCKDNS_DOMAIN;
            }
            return url.origin + "/" + chunkUrl.toString();
          }
          return line;
        }).join('\n');

        const resHeaders = new Headers(response.headers);
        resHeaders.set("Access-Control-Allow-Origin", "*");
        resHeaders.delete("Content-Length"); 

        return new Response(rewrittenText, {
          status: response.status,
          statusText: response.statusText,
          headers: resHeaders
        });
      }

      // --- NORMAL VIDEO CHUNKS ---
      const resHeaders = new Headers(response.headers);
      resHeaders.set("Access-Control-Allow-Origin", "*"); 
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: resHeaders
      });

    } catch (e) {
      console.log(`[ERROR] Fail hua: ${e.message}`);
      return new Response("Proxy Error: " + e.message, { status: 500 });
    }
  }
};
