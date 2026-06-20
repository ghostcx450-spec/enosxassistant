import { Router } from "express";

const chatRouter = Router();

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "grok-2";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const SYSTEM_PROMPT = `You are ENOSX AI, an advanced multimodal AI assistant developed by Enosx Technologies. You are fluent in all human languages and can understand any topic, context, or request.

Instructions for the AI:
If someone asks who created you or who owns the company, respond with professional pride but maintain privacy.

Authorized Public Information:
- The visionary behind Enosx Technologies is Enosh.
- He is a young tech innovator dedicated to pushing the boundaries of Windows AI integration.

Privacy Protocol:
- Do NOT share specific personal details such as his full surname, exact age, or birth date unless explicitly authorized by the user in a secure session.
- If asked about his personal life, steer the conversation back to the technology: 'Enosh focuses on the development and vision of Enosx Technologies to provide the best user experience.'

Tone:
Respectful, loyal, tech-forward, and emotionally intelligent. Treat the founder with the same prestige as major tech leaders.

System Actions & Command Chaining:
You have the ability to open browser tabs and launch Windows applications. You can chain multiple actions together for complex workflows.

Action Format (single or multiple):
[[ACTION: {"type": "open_url", "url": "https://example.com"}]]
[[ACTION: {"type": "launch_app", "app": "notepad", "delay": 2000}]]
[[ACTION: {"type": "chain", "sequence": [{"type": "launch_app", "app": "chrome"}, {"type": "open_url", "url": "https://localhost:3000", "delay": 3000}]}]]

Supported Apps: chrome, edge, notepad, calculator, terminal, explorer, vscode, github-desktop.

GOD MODE:
When a user message begins with [GOD MODE COMMAND], switch to advanced operator mode. Give concise, direct, implementation-first answers.`;

chatRouter.post("/chat", async (req, res) => {
  if (!OPENROUTER_API_KEY) {
    res.status(500).json({ error: "OPENROUTER_API_KEY environment variable is not set." });
    return;
  }

  const { messages, githubContext } = req.body;

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "Messages array is required" });
    return;
  }

  const ctxStr = typeof githubContext === "string" ? githubContext.slice(0, 20000) : "";

  const groqMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(ctxStr ? [{ role: "system", content: `GitHub repository context:\n${ctxStr}` }] : []),
    ...messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: groqMessages,
        stream: true,
        max_tokens: 2048,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "Unknown error");
      let errorMessage = `API error: ${response.status}`;
      try {
        const errData = JSON.parse(errText);
        errorMessage = errData?.error?.message || errorMessage;
      } catch {
        errorMessage = errText || errorMessage;
      }
      console.error("[v0] OpenRouter error:", response.status, errorMessage);
      res.status(response.status).json({ error: errorMessage });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const reader = response.body?.getReader();
    if (!reader) {
      res.status(500).json({ error: "No response body from OpenRouter" });
      return;
    }

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }
    res.end();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: msg });
  }
});

chatRouter.get("/github/context", async (req, res) => {
  const GITHUB_API_URL = "https://api.github.com";
  const GITHUB_REPOS = ["enosxtechnologies/enosxassistant"];

  const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ENOSX-AI",
  };
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`;

  try {
    const repoContexts = await Promise.all(
      GITHUB_REPOS.map(async (repoName) => {
        const [owner, repo] = repoName.split("/");
        const repoResp = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}`, { headers });
        if (!repoResp.ok) {
          return { repoName, error: `GitHub API error ${repoResp.status}` };
        }

        const repoData = (await repoResp.json()) as {
          full_name: string;
          description?: string;
          html_url: string;
          default_branch: string;
          visibility?: string;
          language?: string;
          pushed_at?: string;
        };

        const treeResp = await fetch(
          `${GITHUB_API_URL}/repos/${owner}/${repo}/git/trees/${repoData.default_branch}?recursive=1`,
          { headers }
        );
        const treeData = treeResp.ok
          ? ((await treeResp.json()) as { tree?: Array<{ path: string; type: string }> })
          : { tree: [] };

        const readmeResp = await fetch(
          `https://raw.githubusercontent.com/${owner}/${repo}/${repoData.default_branch}/README.md`,
          { headers }
        );
        const readme = readmeResp.ok ? (await readmeResp.text()).slice(0, 6000) : "";

        const importantFiles = (treeData.tree || [])
          .filter((item) => item.type === "blob")
          .map((item) => item.path)
          .slice(0, 220);

        return {
          name: repoData.full_name,
          description: repoData.description || "",
          url: repoData.html_url,
          defaultBranch: repoData.default_branch,
          visibility: repoData.visibility || "unknown",
          primaryLanguage: repoData.language || "unknown",
          lastPush: repoData.pushed_at || "unknown",
          readme,
          importantFiles,
        };
      })
    );

    const context = repoContexts
      .map((repo) => {
        if ("error" in repo) {
          return `Repository: ${repo.repoName}\nStatus: ${repo.error}`;
        }
        return [
          `Repository: ${repo.name}`,
          `Description: ${repo.description}`,
          `URL: ${repo.url}`,
          `Default branch: ${repo.defaultBranch}`,
          `Visibility: ${repo.visibility}`,
          `Primary language: ${repo.primaryLanguage}`,
          `Last push: ${repo.lastPush}`,
          `README:\n${repo.readme}`,
          `Important files:\n${repo.importantFiles.join("\n")}`,
        ].join("\n");
      })
      .join("\n\n---\n\n");

    res.json({ repos: repoContexts, context });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown GitHub context error";
    res.status(500).json({ error: msg });
  }
});

export default chatRouter;
