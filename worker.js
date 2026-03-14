export default {
  async fetch(request) {
    const url = new URL(request.url);
    // Worker link ke aage jo target URL hai, use nikalna
    let targetUrlStr = request.url.substring(url.origin.length + 1);
    const DUCKDNS_DOMAIN = "sonyrip.duckdns.org"; 

    // Agar URL missing hai, toh guide message dikhao
    if (!targetUrlStr || !targetUrlStr.startsWith("http")) {
      return new Response("Proxy Active! Worker ke URL ke aage target link lagayein.", { status: 200 });
    }

    try {
      let targetObj = new URL(targetUrlStr);
      let originalHost = targetObj.hostname;
      
      // 1. Solid IP Regex Check (Check karega ki Host nanga IP hai ya nahi)
      const isIpAddress = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(originalHost);

      // 2. IP to Domain Swap (Cloudflare ka 1003 Error rokne ke liye)
      if (isIpAddress) {
          targetObj.hostname = DUCKDNS_DOMAIN;
          targetUrlStr = targetObj.toString();
      }

      // 3. Fresh Headers (Bypass Security & Fix 509 Limit)
      const newHeaders = new Headers(request.headers);
      
      // Original Host bhejna zaruri hai (Taaki server connection drop na kare)
      newHeaders.set("Host", originalHost); 
      newHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
      
      // 🚨 THE 509 FIX: Server ko asli Jio IP dikhao taaki Datacenter Bandwidth Limit block na lage
      const clientIP = request.headers.get("CF-Connecting-IP") || "152.59.19.250"; 
      newHeaders.set("X-Forwarded-For", clientIP);
      newHeaders.set("X-Real-IP", clientIP);
      
      // Ye hata do warna strict panels Datacenter/Proxy samajh kar block kar dete hain
      newHeaders.delete("CF-Connecting-IP");
      newHeaders.delete("CF-Ray");
      newHeaders.delete("CF-Visitor");

      // 4. Fetch the Stream (Server se video mango)
      const response = await fetch(targetUrlStr, {
        method: request.method,
        headers: newHeaders,
        redirect: 'manual' // Redirect hum khud handle karenge
      });

      // 5. Smart Redirect Handler (Agar server 301/302 bhej kar IP badle)
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        let location = response.headers.get("Location");
        if (location) {
          let locationUrl = new URL(location, targetUrlStr);
          
          // Hum naya location client ko de denge, client wapas worker ke thru hi aayega
          return new Response(null, {
            status: response.status,
            headers: { 
                "Location": url.origin + "/" + locationUrl.toString(), 
                "Access-Control-Allow-Origin": "*" 
            }
          });
        }
      }

      // 6. Direct Memory-Efficient Streaming (Makhan jaisa chalega, no memory crash)
      return new Response(response.body, {
        status: response.status,
        headers: {
          "Content-Type": response.headers.get("Content-Type") || "video/mp2t",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache",
          // Content-Length pass karna zaruri hai taaki player ko TS file ka size pata chale
          ...(response.headers.has("Content-Length") && {"Content-Length": response.headers.get("Content-Length")})
        }
      });

    } catch (e) {
      return new Response("Streaming Error: " + e.message, { status: 500 });
    }
  }
};
