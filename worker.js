export default {
  async fetch(request) {
    const url = new URL(request.url);
    let targetUrlStr = request.url.substring(url.origin.length + 1);
    const DUCKDNS_DOMAIN = "sonyrip.duckdns.org"; 

    // Agar URL nahi hai, toh guide message
    if (!targetUrlStr || !targetUrlStr.startsWith("http")) {
      return new Response("Proxy Active! Worker ke URL ke aage target link lagayein.", { status: 200 });
    }

    try {
      let targetObj = new URL(targetUrlStr);
      let originalHost = targetObj.hostname;
      
      // 1. Solid IP Regex Check
      const isIpAddress = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(originalHost);

      // 2. IP to Domain Swap (1003 Error rokne ke liye)
      if (isIpAddress) {
          targetObj.hostname = DUCKDNS_DOMAIN;
          targetUrlStr = targetObj.toString();
      }

      // 3. Fresh Headers (Bypass Security)
      const newHeaders = new Headers(request.headers);
      
      // CRITICAL: Agar IP tha, toh server ko original nanga IP hi as a Host dikhao, DuckDNS nahi.
      newHeaders.set("Host", originalHost); 
      
      newHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
      // Baaki kachra headers hata do jo Cloudflare add karta hai
      newHeaders.delete("CF-Connecting-IP");
      newHeaders.delete("X-Forwarded-For");

      // 4. Fetch the Stream
      const response = await fetch(targetUrlStr, {
        method: request.method,
        headers: newHeaders,
        redirect: 'manual' // Redirect hum khud handle karenge
      });

      // 5. Smart Redirect Handler (301/302)
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        let location = response.headers.get("Location");
        if (location) {
          // Agar location relative hai (/live/...), toh use absolute banao
          let locationUrl = new URL(location, targetUrlStr);
          
          // Agar redirect naye IP par ja raha hai, toh wahan bhi naya DuckDNS laga do
          if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(locationUrl.hostname)) {
             // Dhyan dein: Agar IP change ho raha hai toh DuckDNS ka IP bhi update hona chahiye, 
             // warna wo purane IP par hi bhejega.
             // Isliye hum location URL string bhej rahe hain taaki next cycle me handle ho.
          }
          
          return new Response(null, {
            status: response.status,
            headers: { 
                "Location": url.origin + "/" + locationUrl.toString(), 
                "Access-Control-Allow-Origin": "*" 
            }
          });
        }
      }

      // 6. Direct Memory-Efficient Streaming (No TransformStream, sidha Bypass)
      return new Response(response.body, {
        status: response.status,
        headers: {
          "Content-Type": response.headers.get("Content-Type") || "video/mp2t",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache",
          // Content-Length pass karna zaruri hai taaki player ko size pata chale
          ...(response.headers.has("Content-Length") && {"Content-Length": response.headers.get("Content-Length")})
        }
      });

    } catch (e) {
      return new Response("Streaming Error: " + e.message, { status: 500 });
    }
  }
};
