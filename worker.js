export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // 1. Path se Target URL nikalna (safest method)
    const targetUrlStr = request.url.substring(url.origin.length + 1);

    // 2. Agar kisi ne blank open kiya toh ye dikhega
    if (!targetUrlStr || (!targetUrlStr.startsWith("http://") && !targetUrlStr.startsWith("https://"))) {
      return new Response("Doctor sahab ka Universal Proxy Active hai! \nKripya URL ko path mein lagayein.\nExample: " + url.origin + "/http://example.com/live.m3u8", { status: 200 });
    }

    try {
      // 3. Player ke original headers copy karna taaki target server block na kare
      const reqHeaders = new Headers(request.headers);
      
      // Agar player ne User-Agent nahi bheja, toh Tivimate/VLC ka fake laga dete hain (anti-block)
      if (!reqHeaders.has("User-Agent")) {
          reqHeaders.set("User-Agent", "VLC/3.0.18 LibVLC/3.0.18");
      }

      // Important: redirect 'manual' karne se Cloudflare auto-redirect nahi hoga, hum khud handle karenge
      const fetchOptions = {
        method: request.method,
        headers: reqHeaders,
        redirect: 'manual' 
      };

      const response = await fetch(targetUrlStr, fetchOptions);

      // --- BRAMHASTRA 1: REDIRECT (301/302) HANDLER ---
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("Location");
        if (location) {
          // Naye location ka absolute URL banate hain
          const absoluteLocation = new URL(location, targetUrlStr).toString();
          // Uske aage apna proxy chipka dete hain
          const proxiedLocation = url.origin + "/" + absoluteLocation;
          
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

      // --- BRAMHASTRA 2: M3U8 PLAYLIST REWRITER ---
      const contentType = response.headers.get("Content-Type") || "";
      const isM3U8 = contentType.toLowerCase().includes("mpegurl") || targetUrlStr.toLowerCase().includes(".m3u8");

      if (isM3U8) {
        const m3u8Text = await response.text();
        
        // Playlist ke har line ko check karke links modify karna
        const rewrittenText = m3u8Text.split('\n').map(line => {
          const trimmedLine = line.trim();
          // Agar line me # nahi hai aur line khali nahi hai, matlab wo ek video/ts link hai
          if (trimmedLine && !trimmedLine.startsWith("#")) {
            const absoluteChunkUrl = new URL(trimmedLine, targetUrlStr).toString();
            return url.origin + "/" + absoluteChunkUrl;
          }
          return line;
        }).join('\n');

        const resHeaders = new Headers(response.headers);
        resHeaders.set("Access-Control-Allow-Origin", "*");
        resHeaders.delete("Content-Length"); // Kyunki file ka size change ho gaya hai

        return new Response(rewrittenText, {
          status: response.status,
          statusText: response.statusText,
          headers: resHeaders
        });
      }

      // --- NORMAL VIDEO CHUNKS (.ts) KE LIYE ---
      const resHeaders = new Headers(response.headers);
      resHeaders.set("Access-Control-Allow-Origin", "*"); // CORS allow

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
