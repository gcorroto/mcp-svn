import { jest } from "@jest/globals";
import { execFileSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

jest.setTimeout(30000);

test("discovers the SVN tools over stdio and preserves field descriptions", async () => {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc']);
  const env = { ...process.env, SVN_REPOSITORY_URL: "svn://127.0.0.1:9/repo", SVN_USERNAME: "test", SVN_PASSWORD: "test" };
  delete env.SVN_URL;
  delete env.SVN_PATH;
  delete env.SVN_WORKING_DIRECTORY;
  const transport = new StdioClientTransport({ command: process.execPath, args: ["dist/index.js"], env: env as Record<string, string>, stderr: "pipe" });
  let stderr = "";
  transport.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
  const client = new Client({ name: "smoke-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    expect(tools.map(tool => tool.name).sort()).toEqual([
      "svn_health_check", "svn_diagnose", "svn_info", "svn_status", "svn_log", "svn_diff",
      "svn_checkout", "svn_update", "svn_add", "svn_commit", "svn_delete", "svn_revert",
      "svn_cleanup", "svn_cat", "svn_list", "svn_clear_credentials"
    ].sort());
    const info = tools.find(tool => tool.name === "svn_info")!;
    const status = tools.find(tool => tool.name === "svn_status")!;
    expect((info.inputSchema.properties!.path as { description: string }).description).toBe("Local path, full URL, or repo-relative path like '/trunk/foo'");
    expect((status.inputSchema.properties!.showAll as { description: string }).description).toBe("Also show remote status");
    expect(stderr).toContain("Info: SVN_PATH environment variable not set");
    expect(stderr).toContain("Info: SVN_WORKING_DIRECTORY not set");
    expect(stderr).toContain("SVN_PASSWORD: ***");
    expect(stderr).not.toContain("SVN_PASSWORD: test");
  } finally {
    await client.close();
    await transport.close();
  }
});
