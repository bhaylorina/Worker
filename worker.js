export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Original URL se "https://doc.ripalbaria1981.workers.dev/" ko hatakar asli target URL nikalna
    const targetUrl = request.url.replace(url.origin + "/", "");

    // Agar kisi ne URL nahi dala, toh ye message dikhega
    if (!targetUrl || (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://"))) {
      return new Response("Doctor sahab ka Pro Proxy! Kripya URL ko path mein lagayein.\nExample: doc.ripalbaria1981.workers.dev/http://light-ott.net/live.php?mac=123&stream=456", {
        status: 200,
        headers: { "Content-Type": "text/plain" }
      });
    }

    try {
      // Asli server ko request bhejna (Original request ke sabhi headers aur redirect settings ke sath)
      const proxyRequest = new Request(targetUrl, request);
      
      const response = await fetch(proxyRequest);
      
      // Response wapas bhejna, sath mein CORS add karna taaki web players me bhi chale
      const newResponse = new Response(response.body, response);
      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      
      return newResponse;
      
    } catch (e) {
      return new Response("Proxy Error: " + e.message, { status: 500 });
    }
  }
};
