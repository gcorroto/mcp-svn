#!/usr/bin/env node

import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

// Import SVN service
import { SvnService } from "./tools/svn-service.js";
import { formatDuration } from "./common/utils.js";

import { VERSION } from "./common/version.js";

// Create SVN service instance (lazy initialization)
let svnService: SvnService | null = null;

function getSvnService(): SvnService {
  if (!svnService) {
    try {
      svnService = new SvnService();
    } catch (error: any) {
      throw new Error(`SVN configuration error: ${error.message}`);
    }
  }
  return svnService;
}

function buildServer(): McpServer {
  const server = new McpServer({ name: "svn-mcp-server", version: VERSION });

// ----- MCP TOOLS FOR SUBVERSION (SVN) -----

// 1. SVN system health check
server.registerTool("svn_health_check", { description: "Check SVN health and working-copy connectivity", inputSchema: z.object({}) }, async () => {
        try {
          const result = await getSvnService().healthCheck();

          const data = result.data;
          const statusIcon = data?.svnAvailable ? '✅' : '❌';
          const wcIcon = data?.workingCopyValid ? '📁' : '📂';
          const repoIcon = data?.repositoryAccessible ? '🔗' : '🔌';

          const healthText = `${statusIcon} **SVN System Status**\n\n` +
            `**SVN Available:** ${data?.svnAvailable ? 'Yes' : 'No'}\n` +
            `**Version:** ${data?.version || 'N/A'}\n` +
            `${wcIcon} **Working Copy Valid:** ${data?.workingCopyValid ? 'Yes' : 'No'}\n` +
            `${repoIcon} **Repository Accessible:** ${data?.repositoryAccessible ? 'Yes' : 'No'}\n` +
            `**Working Directory:** ${result.workingDirectory}`;

          return {
            content: [{ type: "text", text: healthText }],
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
          };
        }
      });

// 1.1. Advanced SVN command diagnostics
server.registerTool("svn_diagnose", { description: "Run targeted diagnostics on common SVN command failures", inputSchema: z.object({}) }, async () => {
        try {
          const result = await getSvnService().diagnoseCommands();
          const data = result.data!;

          const statusLocalIcon = data.statusLocal ? '✅' : '❌';
          const statusRemoteIcon = data.statusRemote ? '✅' : '❌';
          const logIcon = data.logBasic ? '✅' : '❌';

          let diagnosticText = `🔍 **SVN Command Diagnostics**\n\n` +
            `**Working Directory:** ${data.workingCopyPath}\n\n` +
            `${statusLocalIcon} **Local Status:** ${data.statusLocal ? 'Working' : 'Failed'}\n` +
            `${statusRemoteIcon} **Remote Status:** ${data.statusRemote ? 'Working' : 'Failed'}\n` +
            `${logIcon} **Basic Log:** ${data.logBasic ? 'Working' : 'Failed'}\n`;

          if (data.errors.length > 0) {
            diagnosticText += `\n**Detected Errors:**\n`;
            data.errors.forEach((error, index) => {
              diagnosticText += `${index + 1}. ${error}\n`;
            });
          }

          if (!data.statusRemote || !data.logBasic) {
            diagnosticText += `\n**Possible Solutions:**\n`;
            diagnosticText += `• Check internet connectivity\n`;
            diagnosticText += `• Verify SVN credentials\n`;
            diagnosticText += `• Run 'svn cleanup' if there are lock issues\n`;
            diagnosticText += `• Make sure the working copy is up to date\n`;
          }

          return {
            content: [{ type: "text", text: diagnosticText }],
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `❌ **Diagnostic Error:** ${error.message}` }],
          };
        }
      });

// 2. Get repository information
server.registerTool("svn_info", { description: "Get detailed information about the working copy or a specific file. The path may be a local path, a repository URL, or a repo-relative path starting with '/' (joined with SVN_URL when configured).", inputSchema: z.object({
        path: z.string().optional().describe("Local path, full URL, or repo-relative path like '/trunk/foo'")
      }) }, async (args) => {
        try {
          const result = await getSvnService().getInfo(args.path);
          const info = result.data!;

          const infoText = `📋 **SVN Info**\n\n` +
            `**Path:** ${info.path}\n` +
            `**URL:** ${info.url}\n` +
            `**Relative URL:** ${info.relativeUrl}\n` +
            `**Repository Root:** ${info.repositoryRoot}\n` +
            `**UUID:** ${info.repositoryUuid}\n` +
            `**Revision:** ${info.revision}\n` +
            `**Node Kind:** ${info.nodeKind}\n` +
            `**Last Author:** ${info.lastChangedAuthor}\n` +
            `**Last Changed Revision:** ${info.lastChangedRev}\n` +
            `**Last Changed Date:** ${info.lastChangedDate}\n` +
            `**Working Copy Root:** ${info.workingCopyRootPath}\n` +
            `**Execution Time:** ${formatDuration(result.executionTime || 0)}`;

          return {
            content: [{ type: "text", text: infoText }],
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
          };
        }
      });

// 3. Get file status
server.registerTool("svn_status", { description: "Show the status of files in the working copy", inputSchema: z.object({
        path: z.string().optional().describe("Specific path to query"),
        showAll: z.boolean().optional().default(false).describe("Also show remote status")
      }) }, async (args) => {
        try {
          const result = await getSvnService().getStatus(args.path, args.showAll);
          const statusList = result.data!;

          if (statusList.length === 0) {
            return {
              content: [{ type: "text", text: "✅ **No changes in the working copy**" }],
            };
          }

          const statusText = `📊 **SVN Status** (${statusList.length} items)\n\n` +
            statusList.map(status => {
              const statusIcon: {[key: string]: string} = {
                'added': '➕',
                'deleted': '➖',
                'modified': '✏️',
                'replaced': '🔄',
                'merged': '🔀',
                'conflicted': '⚠️',
                'ignored': '🙈',
                'none': '⚪',
                'normal': '✅',
                'external': '🔗',
                'incomplete': '⏸️',
                'unversioned': '❓',
                'missing': '❌'
              };

              return `${statusIcon[status.status] || '📄'} **${status.status.toUpperCase()}** - ${status.path}`;
            }).join('\n') +
            `\n\n**Execution Time:** ${formatDuration(result.executionTime || 0)}`;

          return {
            content: [{ type: "text", text: statusText }],
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
          };
        }
      });

// 4. Get change history
server.registerTool("svn_log", { description: "Show the commit history of the repository. The path may be a local path, a repository URL, or a repo-relative path starting with '/' (joined with SVN_URL when configured).", inputSchema: z.object({
        path: z.string().optional().describe("Local path, full URL, or repo-relative path like '/trunk/foo'"),
        limit: z.number().optional().default(10).describe("Maximum number of entries"),
        revision: z.string().optional().describe("Specific revision or range (e.g. 100:200)")
      }) }, async (args) => {
        try {
          const result = await getSvnService().getLog(args.path, args.limit, args.revision);
          const logEntries = result.data!;

          if (logEntries.length === 0) {
            return {
              content: [{ type: "text", text: "📝 **No log entries found**" }],
            };
          }

          const logText = `📚 **SVN History** (${logEntries.length} entries)\n\n` +
            logEntries.map((entry, index) =>
              `**${index + 1}. Revision ${entry.revision}**\n` +
              `👤 **Author:** ${entry.author}\n` +
              `📅 **Date:** ${entry.date}\n` +
              `💬 **Message:** ${entry.message || 'No message'}\n` +
              `---`
            ).join('\n\n') +
            `\n**Execution Time:** ${formatDuration(result.executionTime || 0)}`;

          return {
            content: [{ type: "text", text: logText }],
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
          };
        }
      });

// 5. View differences
server.registerTool("svn_diff", { description: "Show differences between file revisions. The path may be a local path, a repository URL, or a repo-relative path starting with '/' (joined with SVN_URL when configured).", inputSchema: z.object({
        path: z.string().optional().describe("Local path, full URL, or repo-relative path like '/trunk/foo'"),
        oldRevision: z.string().optional().describe("Old revision"),
        newRevision: z.string().optional().describe("New revision")
      }) }, async (args) => {
        try {
          const result = await getSvnService().getDiff(args.path, args.oldRevision, args.newRevision);
          const diffOutput = result.data!;

          if (!diffOutput || diffOutput.trim().length === 0) {
            return {
              content: [{ type: "text", text: "✅ **No differences found**" }],
            };
          }

          const diffText = `🔍 **SVN Diff**\n\n` +
            `**Command:** ${result.command}\n` +
            `**Execution Time:** ${formatDuration(result.executionTime || 0)}\n\n` +
            `\`\`\`diff\n${diffOutput}\n\`\`\``;

          return {
            content: [{ type: "text", text: diffText }],
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
          };
        }
      });

// 6. Repository checkout
server.registerTool("svn_checkout", { description: "Check out an SVN repository", inputSchema: z.object({
        url: z.string().describe("SVN repository URL"),
        path: z.string().optional().describe("Destination directory"),
        revision: z.union([z.number(), z.literal("HEAD")]).optional().describe("Specific revision"),
        depth: z.enum(["empty", "files", "immediates", "infinity"]).optional().describe("Checkout depth"),
        force: z.boolean().optional().default(false).describe("Force checkout"),
        ignoreExternals: z.boolean().optional().default(false).describe("Ignore externals")
      }) }, async (args) => {
        try {
          const options = {
            revision: args.revision,
            depth: args.depth,
            force: args.force,
            ignoreExternals: args.ignoreExternals
          };

          const result = await getSvnService().checkout(args.url, args.path, options);

          const checkoutText = `📥 **Checkout Completed**\n\n` +
            `**URL:** ${args.url}\n` +
            `**Destination:** ${args.path || 'Current directory'}\n` +
            `**Command:** ${result.command}\n` +
            `**Execution Time:** ${formatDuration(result.executionTime || 0)}\n\n` +
            `**Output:**\n\`\`\`\n${result.data}\n\`\`\``;

          return {
            content: [{ type: "text", text: checkoutText }],
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
          };
        }
      });

// 7. Update working copy
server.registerTool("svn_update", { description: "Update the working copy from the repository", inputSchema: z.object({
        path: z.string().optional().describe("Specific path to update"),
        revision: z.union([z.number(), z.literal("HEAD"), z.literal("BASE"), z.literal("COMMITTED"), z.literal("PREV")]).optional().describe("Target revision"),
        force: z.boolean().optional().default(false).describe("Force update"),
        ignoreExternals: z.boolean().optional().default(false).describe("Ignore externals"),
        acceptConflicts: z.enum(["postpone", "base", "mine-conflict", "theirs-conflict", "mine-full", "theirs-full"]).optional().describe("How to handle conflicts")
      }) }, async (args) => {
        try {
          const options = {
            revision: args.revision,
            force: args.force,
            ignoreExternals: args.ignoreExternals,
            acceptConflicts: args.acceptConflicts
          };

          const result = await getSvnService().update(args.path, options);

          const updateText = `🔄 **Update Completed**\n\n` +
            `**Path:** ${args.path || 'Current directory'}\n` +
            `**Command:** ${result.command}\n` +
            `**Execution Time:** ${formatDuration(result.executionTime || 0)}\n\n` +
            `**Output:**\n\`\`\`\n${result.data}\n\`\`\``;

          return {
            content: [{ type: "text", text: updateText }],
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
          };
        }
      });

// 8. Add files
server.registerTool("svn_add", { description: "Add files to version control", inputSchema: z.object({
        paths: z.union([z.string(), z.array(z.string())]).describe("File(s) or director(y|ies) to add"),
        force: z.boolean().optional().default(false).describe("Force addition"),
        noIgnore: z.boolean().optional().default(false).describe("Do not honor ignore rules"),
        parents: z.boolean().optional().default(false).describe("Create parent directories if needed"),
        autoProps: z.boolean().optional().describe("Apply auto-props"),
        noAutoProps: z.boolean().optional().describe("Do not apply auto-props")
      }) }, async (args) => {
        try {
          const options = {
            force: args.force,
            noIgnore: args.noIgnore,
            parents: args.parents,
            autoProps: args.autoProps,
            noAutoProps: args.noAutoProps
          };

          const result = await getSvnService().add(args.paths, options);
          const pathsArray = Array.isArray(args.paths) ? args.paths : [args.paths];

          const addText = `➕ **Files Added**\n\n` +
            `**Files:** ${pathsArray.join(', ')}\n` +
            `**Command:** ${result.command}\n` +
            `**Execution Time:** ${formatDuration(result.executionTime || 0)}\n\n` +
            `**Output:**\n\`\`\`\n${result.data}\n\`\`\``;

          return {
            content: [{ type: "text", text: addText }],
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
          };
        }
      });

// 9. Commit changes
server.registerTool("svn_commit", { description: "Commit changes to the repository", inputSchema: z.object({
        message: z.string().describe("Commit message"),
        paths: z.array(z.string()).optional().describe("Specific files to commit"),
        file: z.string().optional().describe("File containing the commit message"),
        force: z.boolean().optional().default(false).describe("Force commit"),
        keepLocks: z.boolean().optional().default(false).describe("Keep locks after commit"),
        noUnlock: z.boolean().optional().default(false).describe("Do not unlock files")
      }) }, async (args) => {
        try {
          const options = {
            message: args.message,
            file: args.file,
            force: args.force,
            keepLocks: args.keepLocks,
            noUnlock: args.noUnlock
          };

          const result = await getSvnService().commit(options, args.paths);

          const commitText = `✅ **Commit Completed**\n\n` +
            `**Message:** ${args.message}\n` +
            `**Files:** ${args.paths?.join(', ') || 'All changes'}\n` +
            `**Command:** ${result.command}\n` +
            `**Execution Time:** ${formatDuration(result.executionTime || 0)}\n\n` +
            `**Output:**\n\`\`\`\n${result.data}\n\`\`\``;

          return {
            content: [{ type: "text", text: commitText }],
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
          };
        }
      });

// 10. Delete files
server.registerTool("svn_delete", { description: "Remove files from version control", inputSchema: z.object({
        paths: z.union([z.string(), z.array(z.string())]).describe("File(s) or director(y|ies) to delete"),
        message: z.string().optional().describe("Message for direct repository deletion"),
        force: z.boolean().optional().default(false).describe("Force deletion"),
        keepLocal: z.boolean().optional().default(false).describe("Keep local copy")
      }) }, async (args) => {
        try {
          const options = {
            message: args.message,
            force: args.force,
            keepLocal: args.keepLocal
          };

          const result = await getSvnService().delete(args.paths, options);
          const pathsArray = Array.isArray(args.paths) ? args.paths : [args.paths];

          const deleteText = `🗑️ **Files Deleted**\n\n` +
            `**Files:** ${pathsArray.join(', ')}\n` +
            `**Keep Local:** ${args.keepLocal ? 'Yes' : 'No'}\n` +
            `**Command:** ${result.command}\n` +
            `**Execution Time:** ${formatDuration(result.executionTime || 0)}\n\n` +
            `**Output:**\n\`\`\`\n${result.data}\n\`\`\``;

          return {
            content: [{ type: "text", text: deleteText }],
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
          };
        }
      });

// 11. Revert changes
server.registerTool("svn_revert", { description: "Revert local changes on files", inputSchema: z.object({
        paths: z.union([z.string(), z.array(z.string())]).describe("File(s) or director(y|ies) to revert")
      }) }, async (args) => {
        try {
          const result = await getSvnService().revert(args.paths);
          const pathsArray = Array.isArray(args.paths) ? args.paths : [args.paths];

          const revertText = `↩️ **Changes Reverted**\n\n` +
            `**Files:** ${pathsArray.join(', ')}\n` +
            `**Command:** ${result.command}\n` +
            `**Execution Time:** ${formatDuration(result.executionTime || 0)}\n\n` +
            `**Output:**\n\`\`\`\n${result.data}\n\`\`\``;

          return {
            content: [{ type: "text", text: revertText }],
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
          };
        }
      });

// 12. Clean up working copy
server.registerTool("svn_cleanup", { description: "Clean up the working copy from interrupted operations", inputSchema: z.object({
        path: z.string().optional().describe("Specific path to clean up")
      }) }, async (args) => {
        try {
          const result = await getSvnService().cleanup(args.path);

          const cleanupText = `🧹 **Cleanup Completed**\n\n` +
            `**Path:** ${args.path || 'Current directory'}\n` +
            `**Command:** ${result.command}\n` +
            `**Execution Time:** ${formatDuration(result.executionTime || 0)}\n\n` +
            `**Output:**\n\`\`\`\n${result.data}\n\`\`\``;

          return {
            content: [{ type: "text", text: cleanupText }],
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
          };
        }
      });

// 13. Show the contents of a versioned file (svn cat)
server.registerTool("svn_cat", { description: "Read a versioned file from the repository (local path, URL, or repo-relative path like '/trunk/foo.sql')", inputSchema: z.object({
        target: z.string().describe("Local path, full URL, or repo-relative path like '/trunk/foo.sql'"),
        revision: z.union([
          z.number(),
          z.literal("HEAD"),
          z.literal("BASE"),
          z.literal("COMMITTED"),
          z.literal("PREV"),
          z.string()
        ]).optional().describe("Revision to query (defaults to HEAD/BASE depending on context)")
      }) }, async (args) => {
        try {
          const result = await getSvnService().cat(args.target, { revision: args.revision });
          const content = result.data ?? '';

          const revisionLabel = args.revision !== undefined ? String(args.revision) : 'HEAD/BASE';
          const header = `📄 **Contents of ${args.target}** (revision: ${revisionLabel})\n\n` +
            `**Command:** ${result.command}\n` +
            `**Execution Time:** ${formatDuration(result.executionTime || 0)}\n\n`;

          if (!content) {
            return {
              content: [{ type: "text", text: header + "*(empty file)*" }],
            };
          }

          return {
            content: [{ type: "text", text: header + `\`\`\`\n${content}\n\`\`\`` }],
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
          };
        }
      });

// 14. List entries of a versioned directory (svn list)
server.registerTool("svn_list", { description: "Browse a versioned directory (local path, URL, or repo-relative path; defaults to the working copy)", inputSchema: z.object({
        target: z.string().optional().describe("Local path, full URL, or repo-relative path like '/tags' (defaults to working copy)"),
        revision: z.union([
          z.number(),
          z.literal("HEAD"),
          z.literal("BASE"),
          z.literal("COMMITTED"),
          z.literal("PREV"),
          z.string()
        ]).optional().describe("Revision to query"),
        verbose: z.boolean().optional().default(false).describe("Include revision, author, size and date"),
        recursive: z.boolean().optional().default(false).describe("List recursively"),
        depth: z.enum(["empty", "files", "immediates", "infinity"]).optional().describe("Listing depth"),
        includeExternals: z.boolean().optional().default(false).describe("Include externals")
      }) }, async (args) => {
        try {
          const result = await getSvnService().list(args.target, {
            revision: args.revision,
            verbose: args.verbose,
            recursive: args.recursive,
            depth: args.depth,
            includeExternals: args.includeExternals
          });

          const { entries, raw } = result.data!;
          const targetLabel = args.target || 'working copy';

          if (entries.length === 0) {
            return {
              content: [{ type: "text", text: `📂 **SVN Listing** (${targetLabel})\n\n*(no entries)*\n\n**Execution Time:** ${formatDuration(result.executionTime || 0)}` }],
            };
          }

          const rows = entries.map(e => {
            const icon = e.kind === 'dir' ? '📁' : '📄';
            if (args.verbose) {
              const size = e.size !== undefined ? `${e.size} B` : '-';
              return `${icon} ${e.name}  (r${e.revision ?? '?'}, ${e.author ?? '?'}, ${size}, ${e.date ?? '?'})`;
            }
            return `${icon} ${e.name}`;
          }).join('\n');

          const listText = `📂 **SVN Listing** (${targetLabel}) — ${entries.length} entries\n\n` +
            `**Command:** ${result.command}\n` +
            `**Execution Time:** ${formatDuration(result.executionTime || 0)}\n\n` +
            rows +
            (args.verbose ? `\n\n<details><summary>Raw output</summary>\n\n\`\`\`\n${raw}\n\`\`\`\n</details>` : '');

          return {
            content: [{ type: "text", text: listText }],
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
          };
        }
      });

// 15. Clear SVN credentials cache (to resolve E215004 errors)
server.registerTool("svn_clear_credentials", { description: "Clear the SVN credentials cache to resolve authentication errors", inputSchema: z.object({}) }, async () => {
        try {
          const result = await getSvnService().clearCredentials();

          const clearText = `🔐 **Credentials Cache Cleared**\n\n` +
            `**Command:** ${result.command}\n` +
            `**Execution Time:** ${formatDuration(result.executionTime || 0)}\n\n` +
            `**Output:**\n\`\`\`\n${result.data}\n\`\`\`\n\n` +
            `**Note:** This can help resolve errors such as:\n` +
            `• E215004: No more credentials or we tried too many times\n` +
            `• Authentication errors due to incorrectly cached credentials`;

          return {
            content: [{ type: "text", text: clearText }],
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
          };
        }
      });

  return server;
}

function runServer() {
  try {
    console.error("Creating SVN MCP Server...");
    console.error("Server info: svn-mcp-server");
    console.error("Version:", VERSION);

    // Validate environment variables
    if (!process.env.SVN_PATH) {
      console.error("Info: SVN_PATH environment variable not set, using 'svn' from PATH");
    } else {
      console.error("SVN_PATH:", process.env.SVN_PATH);
    }

    if (!process.env.SVN_WORKING_DIRECTORY) {
      console.error("Info: SVN_WORKING_DIRECTORY not set, using current directory");
    } else {
      console.error("SVN_WORKING_DIRECTORY:", process.env.SVN_WORKING_DIRECTORY);
    }

    const urlEnv = process.env.SVN_URL || process.env.SVN_REPOSITORY_URL;
    if (urlEnv) {
      console.error("SVN_URL:", urlEnv);
    } else {
      console.error("Info: SVN_URL not set — repo-relative targets (e.g. '/trunk/...') will be treated as local paths");
    }

    if (process.env.SVN_USERNAME) {
      console.error("SVN_USERNAME:", process.env.SVN_USERNAME);
    }

    if (process.env.SVN_PASSWORD) {
      console.error("SVN_PASSWORD:", "***");
    }

    console.error("Starting SVN MCP Server in stdio mode...");

    serveStdio(() => buildServer());

  } catch (error) {
    console.error("Error starting server:", error);
    console.error("Stack trace:", (error as Error).stack);
    process.exit(1);
  }
}

// Start the server
runServer();
