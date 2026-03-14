export default {
  async fetch(request) {
    const url = new URL(request.url);
    let targetUrlStr = request.url.substring(url.origin.length + 1);

    if (!targetUrlStr || !targetUrlStr.startsWith("http")) {
      return new Response("Proxy Active! Worker ke URL ke aage target link lagayein.", { status: 200 });
    }

    try {
      let targetObj = new URL(targetUrlStr);
      let originalHost = targetObj.hostname;
      
      const isIpAddress = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(originalHost);

      // 🌟 THE MAGIC TRICK: Har nange IP ko dynamically nip.io domain bana do
      if (isIpAddress) {
          // Ab kisi DuckDNS ki zarurat nahi!
          targetObj.hostname = `${originalHost}.nip.io`; 
          targetUrlStr = targetObj.toString();
      }

      const newHeaders = new Headers(request.headers);
      newHeaders.set("Host", originalHost); 
      newHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
      
      const clientIP = request.headers.get("CF-Connecting-IP") || "152.59.19.250"; 
      newHeaders.set("X-Forwarded-For", clientIP);
      newHeaders.set("X-Real-IP", clientIP);
      
      newHeaders.delete("CF-Connecting-IP");
      newHeaders.delete("CF-Ray");
      newHeaders.delete("CF-Visitor");

      const response = await fetch(targetUrlStr, {
        method: request.method,
        headers: newHeaders,
        redirect: 'manual' 
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        let location = response.headers.get("Location");
        if (location) {
          let locationUrl = new URL(location, targetUrlStr);
          return new Response(null, {
            status: response.status,
            headers: { 
                "Location": url.origin + "/" + locationUrl.toString(), 
                "Access-Control-Allow-Origin": "*" 
            }
          });
        }
      }

      return new Response(response.body, {
        status: response.status,
        headers: {
          "Content-Type": response.headers.get("Content-Type") || "video/mp2t",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache",
          ...(response.headers.has("Content-Length") && {"Content-Length": response.headers.get("Content-Length")})
        }
      });

    } catch (e) {
      return new Response("Streaming Error: " + e.message, { status: 500 });
    }
  }
};
