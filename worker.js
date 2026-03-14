export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // 1. Path se Target URL nikalna
    const targetUrlStr = request.url.substring(url.origin.length + 1);

    // LOG 1: Pata chalega konsa URL aaya
    console.log(`[START] Request aayi hai: ${request.url}`);
    console.log(`[INFO] Target URL nikala gaya: ${targetUrlStr}`);

    // 2. Blank page handler
    if (!targetUrlStr || (!targetUrlStr.startsWith("http://") && !targetUrlStr.startsWith("https://"))) {
      console.log(`[WARNING] Blank ya galat URL format aaya.`);
      return new Response("Doctor sahab ka Universal Proxy Active hai! \nKripya URL ko path mein lagayein.\nExample: " + url.origin + "/http://example.com/live.m3u8", { status: 200 });
    }

    try {
      const targetObj = new URL(targetUrlStr);

      // --- BRAMHASTRA: HEADERS SPOOFING (403 BYPASS) ---
      // Player ke headers copy karne ke bajaye hum apne fresh headers banayenge
      const reqHeaders = new Headers(request.headers);
      
      reqHeaders.set("Host", targetObj.hostname);
      reqHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
      reqHeaders.set("Accept", "*/*");
      reqHeaders.set("Accept-Language", "en-US,en;q=0.9");
      reqHeaders.set("Connection", "keep-alive");
      reqHeaders.set("Referer", targetObj.origin + "/");
      reqHeaders.set("Origin", targetObj.origin);
      
      // Cloudflare ke sabhi proxy nishaan mita do
      reqHeaders.delete("CF-Connecting-IP");
      reqHeaders.delete("CF-Ray");
      reqHeaders.delete("CF-Visitor");
      reqHeaders.delete("X-Forwarded-Proto");
      reqHeaders.delete("X-Forwarded-For");
      reqHeaders.delete("X-Real-IP");

      console.log(`[FETCH] Ab Target Server (${targetObj.hostname}) ko request bhej rahe hain...`);

      const fetchOptions = {
        method: request.method,
        headers: reqHeaders,
        redirect: 'manual' 
      };

      const response = await fetch(targetUrlStr, fetchOptions);
      
      // LOG 2: Target server ne kya jawab diya
      console.log(`[RESPONSE] Target Server ka Status Code: ${response.status}`);

      // --- REDIRECT (301/302) HANDLER ---
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("Location");
        console.log(`[REDIRECT] Server ne redirect kiya is naye link par: ${location}`);
        
        if (location) {
          const absoluteLocation = new URL(location, targetUrlStr).toString();
          const proxiedLocation = url.origin + "/" + absoluteLocation;
          
          const resHeaders = new Headers(response.headers);
          resHeaders.set("Location", proxiedLocation);
          resHeaders.set("Access-Control-Allow-Origin", "*");
          
          console.log(`[SUCCESS] Redirect ko successfully proxy link me badal diya: ${proxiedLocation}`);
          return new Response(null, {
            status: response.status,
            statusText: response.statusText,
            headers: resHeaders
          });
        }
      }

      // --- M3U8 PLAYLIST REWRITER ---
      const contentType = response.headers.get("Content-Type") || "";
      const isM3U8 = contentType.toLowerCase().includes("mpegurl") || targetUrlStr.toLowerCase().includes(".m3u8");

      if (isM3U8) {
        console.log(`[M3U8] Playlist file mili hai, uske andar ke links rewrite kar rahe hain...`);
        const m3u8Text = await response.text();
        
        const rewrittenText = m3u8Text.split('\n').map(line => {
          const trimmedLine = line.trim();
          if (trimmedLine && !trimmedLine.startsWith("#")) {
            const absoluteChunkUrl = new URL(trimmedLine, targetUrlStr).toString();
            return url.origin + "/" + absoluteChunkUrl;
          }
          return line;
        }).join('\n');

        const resHeaders = new Headers(response.headers);
        resHeaders.set("Access-Control-Allow-Origin", "*");
        resHeaders.delete("Content-Length"); 

        console.log(`[SUCCESS] M3U8 Playlist rewrite complete!`);
        return new Response(rewrittenText, {
          status: response.status,
          statusText: response.statusText,
          headers: resHeaders
        });
      }

      // --- NORMAL VIDEO CHUNKS (.ts) KE LIYE ---
      console.log(`[SUCCESS] Normal Video Chunk (.ts) safely pass kar diya gaya.`);
      const resHeaders = new Headers(response.headers);
      resHeaders.set("Access-Control-Allow-Origin", "*"); 

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: resHeaders
      });

    } catch (e) {
      console.error(`[CRITICAL ERROR] Proxy fail ho gaya: ${e.message}`);
      return new Response("Proxy Error: " + e.message, { status: 500 });
    }
  }
};
