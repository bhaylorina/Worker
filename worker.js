export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrlStr = request.url.substring(url.origin.length + 1);

    console.log(`[START] Request aayi hai: ${request.url}`);
    
    if (!targetUrlStr || (!targetUrlStr.startsWith("http://") && !targetUrlStr.startsWith("https://"))) {
      return new Response("Doctor sahab ka Universal Proxy Active hai! \nKripya URL ko path mein lagayein.", { status: 200 });
    }

    try {
      const targetObj = new URL(targetUrlStr);
      const reqHeaders = new Headers(request.headers);
      
      reqHeaders.set("Host", targetObj.hostname);
      reqHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
      reqHeaders.set("Accept", "*/*");
      reqHeaders.set("Accept-Language", "en-US,en;q=0.9");
      reqHeaders.set("Connection", "keep-alive");
      reqHeaders.set("Referer", targetObj.origin + "/");
      reqHeaders.set("Origin", targetObj.origin);
      
      reqHeaders.delete("CF-Connecting-IP");
      reqHeaders.delete("CF-Ray");
      reqHeaders.delete("CF-Visitor");
      reqHeaders.delete("X-Forwarded-Proto");
      reqHeaders.delete("X-Forwarded-For");
      reqHeaders.delete("X-Real-IP");

      const fetchOptions = {
        method: request.method,
        headers: reqHeaders,
        redirect: 'manual' 
      };

      const response = await fetch(targetUrlStr, fetchOptions);
      console.log(`[RESPONSE] Target Server Status: ${response.status}`);

      // --- REDIRECT HANDLER ---
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("Location");
        if (location) {
          let locationUrl = new URL(location, targetUrlStr);
          
          // BRAMHASTRA 4: IP to Domain Fix (1003 Error Bypass)
          if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(locationUrl.hostname)) {
              console.log(`[FIX] Redirect me IP (${locationUrl.hostname}) mila. CF 1003 error rokne ke liye isko Domain (${targetObj.hostname}) se badal rahe hain.`);
              locationUrl.hostname = targetObj.hostname;
          }

          const proxiedLocation = url.origin + "/" + locationUrl.toString();
          
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
        const m3u8Text = await response.text();
        
        const rewrittenText = m3u8Text.split('\n').map(line => {
          const trimmedLine = line.trim();
          if (trimmedLine && !trimmedLine.startsWith("#")) {
            let chunkUrl = new URL(trimmedLine, targetUrlStr);
            // M3U8 ke andar bhi IP ko Domain me badlo
            if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(chunkUrl.hostname)) {
                chunkUrl.hostname = targetObj.hostname;
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

      // --- NORMAL CHUNKS ---
      const resHeaders = new Headers(response.headers);
      resHeaders.set("Access-Control-Allow-Origin", "*"); 
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: resHeaders
      });

    } catch (e) {
      return new Response("Proxy Error: " + e.message, { status: 500 });
    }
  }
};
