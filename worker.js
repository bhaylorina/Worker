export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrlStr = request.url.substring(url.origin.length + 1);

    // LOG 1: Check karte hain ki user ne kya URL manga hai
    console.log(`[START] Request aayi hai: ${request.url}`);
    console.log(`[INFO] Target URL nikala gaya: ${targetUrlStr}`);

    if (!targetUrlStr || (!targetUrlStr.startsWith("http://") && !targetUrlStr.startsWith("https://"))) {
      console.log(`[WARNING] Blank ya galat URL format aaya.`);
      return new Response("Doctor sahab ka Universal Proxy Active hai! \nKripya URL ko path mein lagayein.\nExample: " + url.origin + "/http://example.com/live.m3u8", { status: 200 });
    }

    try {
      const reqHeaders = new Headers(request.headers);
      if (!reqHeaders.has("User-Agent")) {
          reqHeaders.set("User-Agent", "VLC/3.0.18 LibVLC/3.0.18");
      }

      // Host header fix
      const targetObj = new URL(targetUrlStr);
      reqHeaders.set("Host", targetObj.hostname);
      reqHeaders.delete("Origin");
      reqHeaders.delete("Referer");

      console.log(`[FETCH] Ab Target Server (${targetObj.hostname}) ko request bhej rahe hain...`);

      const fetchOptions = {
        method: request.method,
        headers: reqHeaders,
        redirect: 'manual' 
      };

      const response = await fetch(targetUrlStr, fetchOptions);
      
      // LOG 2: Target server ne kya jawab diya
      console.log(`[RESPONSE] Target Server ka Status Code: ${response.status}`);

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

      console.log(`[SUCCESS] Normal Video Chunk (.ts) safely pass kar diya gaya.`);
      const resHeaders = new Headers(response.headers);
      resHeaders.set("Access-Control-Allow-Origin", "*"); 

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: resHeaders
      });

    } catch (e) {
      // LOG 3: Agar koi bada error aata hai (Jaise server down ho)
      console.error(`[CRITICAL ERROR] Proxy fail ho gaya: ${e.message}`);
      return new Response("Proxy Error: " + e.message, { status: 500 });
    }
  }
};
