export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Apna GitHub Username yahan likhein (jaise "bhaylorina" ya "ripalbaria")
    const githubUser = "bhaylorina";

    // URL Path ko todna: /RepoName/BranchName/file.m3u
    const pathParts = url.pathname.split("/").filter(Boolean);

    // Agar koi bina file path ke link khole (jaise Preview mein)
    if (pathParts.length < 3) {
      return new Response(
        "Worker Chalu Hai!\nSahi URL format use karein:\nhttps://" + url.hostname + "/RepoName/main/playlist.m3u",
        { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    }

    const repo = pathParts[0]; // Jaise: Zago
    const branch = pathParts[1]; // Jaise: main
    const filePath = pathParts.slice(2).join("/"); // Jaise: abc.m3u

    // 2. GitHub API URL (Yeh raw.githubusercontent ka 5-minute cache bypass karta hai)
    const apiUrl = `https://api.github.com/repos/${githubUser}/${repo}/contents/${filePath}?ref=${branch}&t=${Date.now()}`;

    // 3. Fetch Request with 100% Cache Bypass
    const response = await fetch(apiUrl, {
      cf: {
        cacheTtl: 0,
        cacheEverything: false
      },
      headers: {
        "Authorization": `token ${env.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3.raw", // Raw playlist file mangwane ke liye
        "User-Agent": "Cloudflare-Worker-IPTV",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache"
      }
    });

    // Agar file nahi mili ya Token galat hai
    if (!response.ok) {
      return new Response(
        `Error: File nahi mili (Status: ${response.status}).\nCheck karein ki Repo/File ka naam aur GITHUB_TOKEN sahi hai.`,
        { status: response.status, headers: { "Content-Type": "text/plain" } }
      );
    }

    // 4. IPTV Player ko bhi Cache karne se rokna (Every request = Fresh)
    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", "audio/x-mpegurl; charset=utf-8");
    responseHeaders.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    responseHeaders.set("Pragma", "no-cache");
    responseHeaders.set("Expires", "0");
    responseHeaders.set("Access-Control-Allow-Origin", "*");

    return new Response(response.body, {
      status: 200,
      headers: responseHeaders
    });
  }
};
