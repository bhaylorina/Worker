export default {
  async fetch(request, env, ctx) {
    // 1. Original URL ko pakdo
    const url = new URL(request.url);
    
    // 2. Humara Target URL nikaalo (?url= parameter se)
    const targetUrlStr = url.searchParams.get('url');

    // Agar kisine bina ?url= ke access kiya, toh warning dikhao
    if (!targetUrlStr) {
      return new Response("Doctor sahab ka Universal Proxy! Kripya ?url= parameter lagayein.", { status: 400 });
    }

    try {
      const targetUrl = new URL(targetUrlStr);

      // 3. Request ko nayi jagah (Target) par bhejne ke liye taiyar karo
      const newRequest = new Request(targetUrl, {
        method: request.method,
        headers: request.headers,
        redirect: "follow",
      });

      // 🚀 4. THE 1003 BYPASS (Sabse Zaroori)
      // Original Host aur Referer delete kar do, taaki Cloudflare confuse na ho
      // aur target server ko lage ki direct user se request aayi hai.
      newRequest.headers.delete("Host");
      newRequest.headers.delete("Referer");

      // 5. Asli Server se video/data fetch karo
      let response = await fetch(newRequest);

      // 6. Response ko wapas bhejne se pe usme CORS Headers daal do 
      // (Taaki ExoPlayer ya App koi nakhre na kare)
      let newResponse = new Response(response.body, response);
      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      newResponse.headers.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
      newResponse.headers.set("Access-Control-Allow-Headers", "*");

      return newResponse;

    } catch (e) {
      return new Response("Proxy Doctor Error: " + e.message, { status: 500 });
    }
  },
};
