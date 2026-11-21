import {
  SvnConfig,
  SvnResponse,
  SvnInfo,
  SvnStatus,
  SvnLogEntry,
  SvnCheckoutOptions,
  SvnUpdateOptions,
  SvnCommitOptions,
  SvnAddOptions,
  SvnDeleteOptions,
  SvnCatOptions,
  SvnListOptions,
  SvnListEntry,
  SvnError
} from '../common/types.js';

import {
  createSvnConfig,
  executeSvnCommand,
  parseInfoOutput,
  parseStatusOutput,
  parseLogOutput,
  parseListOutput,
  validateSvnInstallation,
  isWorkingCopy,
  normalizePath,
  validatePath,
  validateSvnUrl,
  resolveSvnTarget,
  cleanOutput,
  formatDuration,
  clearSvnCredentials
} from '../common/utils.js';

export class SvnService {
  private config: SvnConfig;

  constructor(config: Partial<SvnConfig> = {}) {
    this.config = createSvnConfig(config);
  }

  /**
   * Helper function to handle common SVN errors
   */
  private handleSvnError(error: any, operation: string): never {
    let message = `Failed to ${operation}`;

    if (error.message.includes('E155007') || error.message.includes('not a working copy')) {
      message = `'${this.config.workingDirectory}' is not an SVN working copy. Run checkout first or point SVN_WORKING_DIRECTORY at a valid checkout.`;
    } else if (error.message.includes('E175002') || error.message.includes('Unable to connect')) {
      message = `Cannot reach the SVN repository — check network access and credentials.`;
    } else if (error.message.includes('E170001') || error.message.includes('Authentication failed')) {
      message = `SVN authentication failed — verify SVN_USERNAME and SVN_PASSWORD.`;
    } else if (error.message.includes('E155036') || error.message.includes('working copy locked')) {
      message = `The working copy is locked. Run 'svn cleanup' to resolve it.`;
    } else if (error.message.includes('E200030') || error.message.includes('sqlite')) {
      message = `Working copy database error. Run 'svn cleanup' to repair it.`;
    } else if (error.stderr && error.stderr.length > 0) {
      message = `${message}: ${error.stderr}`;
    } else {
      message = `${message}: ${error.message}`;
    }

    throw new SvnError(message);
  }

  /**
   * Verify that SVN is available and correctly configured
   */
  async healthCheck(): Promise<SvnResponse<{
    svnAvailable: boolean;
    version?: string;
    workingCopyValid?: boolean;
    repositoryAccessible?: boolean;
  }>> {
    try {
      // Verify SVN installation
      const svnAvailable = await validateSvnInstallation(this.config);
      if (!svnAvailable) {
        return {
          success: false,
          error: 'SVN is not available in the system PATH',
          command: 'svn --version',
          workingDirectory: this.config.workingDirectory!
        };
      }

      // Get SVN version
      const versionResponse = await executeSvnCommand(this.config, ['--version', '--quiet']);
      const version = versionResponse.data as string;

      // Check whether we are inside a working copy
      const workingCopyValid = await isWorkingCopy(this.config.workingDirectory!);

      let repositoryAccessible = false;
      if (workingCopyValid) {
        try {
          await this.getInfo();
          repositoryAccessible = true;
        } catch (error) {
          repositoryAccessible = false;
        }
      }

      return {
        success: true,
        data: {
          svnAvailable,
          version: version.trim(),
          workingCopyValid,
          repositoryAccessible
        },
        command: 'health-check',
        workingDirectory: this.config.workingDirectory!
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        command: 'health-check',
        workingDirectory: this.config.workingDirectory!
      };
    }
  }

  /**
   * Get information about the working copy or a specific directory
   */
  async getInfo(path?: string): Promise<SvnResponse<SvnInfo>> {
    try {
      const args = ['info'];
      if (path) {
        args.push(resolveSvnTarget(path, this.config).value);
      }

      const response = await executeSvnCommand(this.config, args);
      const info = parseInfoOutput(cleanOutput(response.data as string));

      return {
        success: true,
        data: info,
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime
      };

    } catch (error: any) {
      this.handleSvnError(error, 'get SVN info');
    }
  }

  /**
   * Get the status of files in the working copy
   */
  async getStatus(path?: string, showAll: boolean = false): Promise<SvnResponse<SvnStatus[]>> {
    try {
      const args = ['status'];
      
      if (path) {
        if (!validatePath(path)) {
          throw new SvnError(`Invalid path: ${path}`);
        }
        args.push(normalizePath(path));
      }

      let response;

      // If showAll is true, try first with --show-updates
      if (showAll) {
        try {
          const argsWithUpdates = [...args, '--show-updates'];
          response = await executeSvnCommand(this.config, argsWithUpdates);
        } catch (error: any) {
          // If --show-updates fails, fall back to local status only
          console.warn(`Warning: --show-updates failed, falling back to local status only: ${error.message}`);
          response = await executeSvnCommand(this.config, args);
        }
      } else {
        response = await executeSvnCommand(this.config, args);
      }

      const statusList = parseStatusOutput(cleanOutput(response.data as string));

      return {
        success: true,
        data: statusList,
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime
      };

    } catch (error: any) {
      this.handleSvnError(error, 'get SVN status');
    }
  }

  /**
   * Get change history (log)
   */
  async getLog(
    path?: string,
    limit?: number,
    revision?: string
  ): Promise<SvnResponse<SvnLogEntry[]>> {
    try {
      const args = ['log'];

      if (limit && limit > 0) {
        args.push('--limit', limit.toString());
      }

      if (revision) {
        args.push('--revision', revision);
      }

      if (path) {
        args.push(resolveSvnTarget(path, this.config).value);
      }

      let response;
      try {
        response = await executeSvnCommand(this.config, args);
      } catch (error: any) {
        // Detect if SVN is not installed
        if ((error.message.includes('spawn') && error.message.includes('ENOENT')) ||
            error.code === 127) {
          const enhancedError = new SvnError(
            'SVN is not installed or not found in the system PATH. Install Subversion to use this command.'
          );
          enhancedError.command = error.command;
          enhancedError.code = error.code;
          throw enhancedError;
        }

        // Detect network/connectivity errors and surface more helpful messages
        if (error.message.includes('E175002') ||
            error.message.includes('Unable to connect') ||
            error.message.includes('Connection refused') ||
            error.message.includes('Network is unreachable') ||
            error.code === 1) {

          console.warn(`Remote log failed, possible connectivity issue: ${error.message}`);

          const enhancedError = new SvnError(
            `Could not retrieve change history. Possible causes:
            - No connectivity to the SVN server
            - Credentials required but not provided
            - SVN server temporarily unreachable
            - Working copy out of sync with the remote repository`
          );
          enhancedError.command = error.command;
          enhancedError.stderr = error.stderr;
          enhancedError.code = error.code;
          throw enhancedError;
        }
        // Re-throw any other error unchanged
        throw error;
      }

      const logEntries = parseLogOutput(cleanOutput(response.data as string));

      return {
        success: true,
        data: logEntries,
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime
      };

    } catch (error: any) {
      this.handleSvnError(error, 'get SVN log');
    }
  }

  /**
   * Get differences between revisions
   */
  async getDiff(
    path?: string,
    oldRevision?: string,
    newRevision?: string
  ): Promise<SvnResponse<string>> {
    try {
      const args = ['diff'];
      const resolved = path ? resolveSvnTarget(path, this.config).value : undefined;

      if (oldRevision && newRevision) {
        const base = resolved || '.';
        args.push('--old', `${base}@${oldRevision}`);
        args.push('--new', `${base}@${newRevision}`);
      } else if (oldRevision) {
        args.push('--revision', oldRevision);
        if (resolved) {
          args.push(resolved);
        }
      } else if (resolved) {
        args.push(resolved);
      }

      const response = await executeSvnCommand(this.config, args);

      return {
        success: true,
        data: cleanOutput(response.data as string),
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime
      };

    } catch (error: any) {
      throw new SvnError(`Failed to get SVN diff: ${error.message}${error.stderr ? `\n${error.stderr}` : ''}`);
    }
  }

  /**
   * Check out a repository
   */
  async checkout(
    url: string,
    path?: string,
    options: SvnCheckoutOptions = {}
  ): Promise<SvnResponse<string>> {
    try {
      if (!validateSvnUrl(url)) {
        throw new SvnError(`Invalid SVN URL: ${url}`);
      }

      const args = ['checkout'];
      
      if (options.revision) {
        args.push('--revision', options.revision.toString());
      }
      
      if (options.depth) {
        args.push('--depth', options.depth);
      }
      
      if (options.force) {
        args.push('--force');
      }
      
      if (options.ignoreExternals) {
        args.push('--ignore-externals');
      }

      args.push(url);
      
      if (path) {
        if (!validatePath(path)) {
          throw new SvnError(`Invalid path: ${path}`);
        }
        args.push(normalizePath(path));
      }

      const response = await executeSvnCommand(this.config, args);

      return {
        success: true,
        data: cleanOutput(response.data as string),
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime
      };

    } catch (error: any) {
      throw new SvnError(`Failed to checkout: ${error.message}${error.stderr ? `\n${error.stderr}` : ''}`);
    }
  }

  /**
   * Update the working copy
   */
  async update(
    path?: string,
    options: SvnUpdateOptions = {}
  ): Promise<SvnResponse<string>> {
    try {
      const args = ['update'];
      
      if (options.revision) {
        args.push('--revision', options.revision.toString());
      }
      
      if (options.force) {
        args.push('--force');
      }
      
      if (options.ignoreExternals) {
        args.push('--ignore-externals');
      }
      
      if (options.acceptConflicts) {
        args.push('--accept', options.acceptConflicts);
      }
      
      if (path) {
        if (!validatePath(path)) {
          throw new SvnError(`Invalid path: ${path}`);
        }
        args.push(normalizePath(path));
      }

      const response = await executeSvnCommand(this.config, args);

      return {
        success: true,
        data: cleanOutput(response.data as string),
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime
      };

    } catch (error: any) {
      throw new SvnError(`Failed to update: ${error.message}${error.stderr ? `\n${error.stderr}` : ''}`);
    }
  }

  /**
   * Add files to version control
   */
  async add(
    paths: string | string[],
    options: SvnAddOptions = {}
  ): Promise<SvnResponse<string>> {
    try {
      const pathArray = Array.isArray(paths) ? paths : [paths];
      
      // Validate all paths
      for (const path of pathArray) {
        if (!validatePath(path)) {
          throw new SvnError(`Invalid path: ${path}`);
        }
      }

      const args = ['add'];
      
      if (options.force) {
        args.push('--force');
      }
      
      if (options.noIgnore) {
        args.push('--no-ignore');
      }
      
      if (options.autoProps) {
        args.push('--auto-props');
      }
      
      if (options.noAutoProps) {
        args.push('--no-auto-props');
      }
      
      if (options.parents) {
        args.push('--parents');
      }

      // Append normalized paths
      args.push(...pathArray.map(p => normalizePath(p)));

      const response = await executeSvnCommand(this.config, args);

      return {
        success: true,
        data: cleanOutput(response.data as string),
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime
      };

    } catch (error: any) {
      throw new SvnError(`Failed to add files: ${error.message}${error.stderr ? `\n${error.stderr}` : ''}`);
    }
  }

  /**
   * Commit changes to the repository
   */
  async commit(
    options: SvnCommitOptions,
    paths?: string[]
  ): Promise<SvnResponse<string>> {
    try {
      if (!options.message && !options.file) {
        throw new SvnError('Commit message is required');
      }

      const args = ['commit'];
      
      // svn rejects --message together with --file, and the tool schema always requires a message
      if (options.file) {
        args.push('--file', normalizePath(options.file));
      } else if (options.message) {
        args.push('--message', options.message);
      }

      if (options.force) {
        args.push('--force');
      }
      
      if (options.keepLocks) {
        args.push('--keep-locks');
      }
      
      if (options.noUnlock) {
        args.push('--no-unlock');
      }

      // Append specific paths when provided
      if (paths && paths.length > 0) {
        for (const path of paths) {
          if (!validatePath(path)) {
            throw new SvnError(`Invalid path: ${path}`);
          }
        }
        args.push(...paths.map(p => normalizePath(p)));
      } else if (options.targets) {
        args.push(...options.targets.map(p => normalizePath(p)));
      }

      const response = await executeSvnCommand(this.config, args);

      return {
        success: true,
        data: cleanOutput(response.data as string),
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime
      };

    } catch (error: any) {
      throw new SvnError(`Failed to commit: ${error.message}${error.stderr ? `\n${error.stderr}` : ''}`);
    }
  }

  /**
   * Remove files from version control
   */
  async delete(
    paths: string | string[],
    options: SvnDeleteOptions = {}
  ): Promise<SvnResponse<string>> {
    try {
      const pathArray = Array.isArray(paths) ? paths : [paths];
      
      // Validate all paths
      for (const path of pathArray) {
        if (!validatePath(path)) {
          throw new SvnError(`Invalid path: ${path}`);
        }
      }

      const args = ['delete'];
      
      if (options.force) {
        args.push('--force');
      }
      
      if (options.keepLocal) {
        args.push('--keep-local');
      }
      
      if (options.message) {
        args.push('--message', options.message);
      }

      // Append normalized paths
      args.push(...pathArray.map(p => normalizePath(p)));

      const response = await executeSvnCommand(this.config, args);

      return {
        success: true,
        data: cleanOutput(response.data as string),
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime
      };

    } catch (error: any) {
      throw new SvnError(`Failed to delete files: ${error.message}${error.stderr ? `\n${error.stderr}` : ''}`);
    }
  }

  /**
   * Revert local changes
   */
  async revert(paths: string | string[]): Promise<SvnResponse<string>> {
    try {
      const pathArray = Array.isArray(paths) ? paths : [paths];
      
      // Validate all paths
      for (const path of pathArray) {
        if (!validatePath(path)) {
          throw new SvnError(`Invalid path: ${path}`);
        }
      }

      const args = ['revert'];
      
      // Append normalized paths
      args.push(...pathArray.map(p => normalizePath(p)));

      const response = await executeSvnCommand(this.config, args);

      return {
        success: true,
        data: cleanOutput(response.data as string),
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime
      };

    } catch (error: any) {
      throw new SvnError(`Failed to revert files: ${error.message}${error.stderr ? `\n${error.stderr}` : ''}`);
    }
  }

  /**
   * Clean up the working copy
   */
  async cleanup(path?: string): Promise<SvnResponse<string>> {
    try {
      const args = ['cleanup'];
      
      if (path) {
        if (!validatePath(path)) {
          throw new SvnError(`Invalid path: ${path}`);
        }
        args.push(normalizePath(path));
      }

      const response = await executeSvnCommand(this.config, args);

      return {
        success: true,
        data: cleanOutput(response.data as string),
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime
      };

    } catch (error: any) {
      throw new SvnError(`Failed to cleanup: ${error.message}${error.stderr ? `\n${error.stderr}` : ''}`);
    }
  }

  /**
   * Targeted diagnostics for problematic commands
   */
  async diagnoseCommands(): Promise<SvnResponse<{
    statusLocal: boolean;
    statusRemote: boolean;
    logBasic: boolean;
    workingCopyPath: string;
    errors: string[];
    suggestions: string[];
  }>> {
    const results = {
      statusLocal: false,
      statusRemote: false,
      logBasic: false,
      workingCopyPath: this.config.workingDirectory!,
      errors: [] as string[],
      suggestions: [] as string[]
    };

    try {
      // Test local svn status
      try {
        await executeSvnCommand(this.config, ['status']);
        results.statusLocal = true;
      } catch (error: any) {
        const errorMsg = this.categorizeError(error, 'local status');
        results.errors.push(errorMsg.message);
        if (errorMsg.suggestion) {
          results.suggestions.push(errorMsg.suggestion);
        }
      }

      // Test svn status with --show-updates
      try {
        await executeSvnCommand(this.config, ['status', '--show-updates']);
        results.statusRemote = true;
      } catch (error: any) {
        const errorMsg = this.categorizeError(error, 'remote status');
        results.errors.push(errorMsg.message);
        if (errorMsg.suggestion) {
          results.suggestions.push(errorMsg.suggestion);
        }
      }

      // Test basic svn log
      try {
        await executeSvnCommand(this.config, ['log', '--limit', '1']);
        results.logBasic = true;
      } catch (error: any) {
        const errorMsg = this.categorizeError(error, 'basic log');
        results.errors.push(errorMsg.message);
        if (errorMsg.suggestion) {
          results.suggestions.push(errorMsg.suggestion);
        }
      }

      // Add general suggestions based on the results
      if (!results.statusRemote && !results.logBasic && results.statusLocal) {
        results.suggestions.push('Remote commands fail but the local one works. Review network connectivity and SVN credentials.');
      }

      return {
        success: true,
        data: results,
        command: 'diagnostic',
        workingDirectory: this.config.workingDirectory!
      };

    } catch (error: any) {
      results.errors.push(`General error: ${error.message}`);
      return {
        success: false,
        data: results,
        error: error.message,
        command: 'diagnostic',
        workingDirectory: this.config.workingDirectory!
      };
    }
  }

  /**
   * Categorize errors and provide specific suggestions
   */
  private categorizeError(error: any, commandType: string): { message: string; suggestion?: string } {
    const baseMessage = `${commandType} failed`;

    // SVN not found in the system
    if ((error.message.includes('spawn') && error.message.includes('ENOENT')) ||
        error.code === 127) {
      return {
        message: `${baseMessage}: SVN is not installed or not found in PATH`,
        suggestion: 'Install SVN (subversion) or make sure it is available in the system PATH'
      };
    }

    // Connectivity errors
    if (error.message.includes('E175002') ||
        error.message.includes('Unable to connect') ||
        error.message.includes('Connection refused') ||
        error.message.includes('Network is unreachable')) {
      return {
        message: `${baseMessage}: No connectivity to the SVN server`,
        suggestion: 'Check your internet connection and that the SVN server is reachable'
      };
    }

    // Authentication errors - too many attempts
    if (error.message.includes('E215004') ||
        error.message.includes('No more credentials') ||
        error.message.includes('we tried too many times')) {
      return {
        message: `${baseMessage}: Too many failed authentication attempts`,
        suggestion: 'Credentials may be incorrect or cached. Clear the SVN credentials cache and verify SVN_USERNAME and SVN_PASSWORD'
      };
    }

    // General authentication errors
    if (error.message.includes('E170001') ||
        error.message.includes('Authentication failed') ||
        error.message.includes('authorization failed')) {
      return {
        message: `${baseMessage}: Authentication error`,
        suggestion: 'Verify your SVN credentials (SVN_USERNAME and SVN_PASSWORD)'
      };
    }

    // Invalid working copy
    if (error.message.includes('E155007') ||
        error.message.includes('not a working copy')) {
      return {
        message: `${baseMessage}: Not a valid working copy`,
        suggestion: 'Make sure you are in an SVN checkout directory or run svn checkout first'
      };
    }

    // Working copy locked
    if (error.message.includes('E155036') ||
        error.message.includes('working copy locked')) {
      return {
        message: `${baseMessage}: Working copy locked`,
        suggestion: 'Run "svn cleanup" to unlock the working copy'
      };
    }

    // Generic exit code 1 (common with remote commands)
    if (error.code === 1) {
      return {
        message: `${baseMessage}: Command failed with exit code 1 (possible network/authentication issue)`,
        suggestion: 'Check network connectivity, SVN credentials, and that the repository is reachable'
      };
    }

    // Fallback
    return {
      message: `${baseMessage}: ${error.message}`,
      suggestion: undefined
    };
  }

  /**
   * Clear the SVN credentials cache to resolve authentication errors
   */
  async clearCredentials(): Promise<SvnResponse> {
    return await clearSvnCredentials(this.config);
  }

  /**
   * Show the contents of a versioned file (svn cat).
   * Accepts a local path or a repository URL.
   */
  async cat(target: string, options: SvnCatOptions = {}): Promise<SvnResponse<string>> {
    try {
      if (!target || typeof target !== 'string') {
        throw new SvnError('Target path or URL is required for svn cat');
      }

      const args = ['cat'];

      if (options.revision !== undefined && options.revision !== null && options.revision !== '') {
        args.push('--revision', String(options.revision));
      }

      args.push(resolveSvnTarget(target, this.config).value);

      const response = await executeSvnCommand(this.config, args);

      return {
        success: true,
        data: cleanOutput(response.data as string),
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime
      };

    } catch (error: any) {
      this.handleSvnError(error, 'get file contents (svn cat)');
    }
  }

  /**
   * List entries of a versioned directory (svn list).
   * Accepts a local path or a repository URL. If no target is given, the working copy is used.
   */
  async list(
    target?: string,
    options: SvnListOptions = {}
  ): Promise<SvnResponse<{ entries: SvnListEntry[]; raw: string }>> {
    try {
      const args = ['list'];

      if (options.verbose) {
        args.push('--verbose');
      }

      if (options.depth) {
        args.push('--depth', options.depth);
      } else if (options.recursive) {
        args.push('--recursive');
      }

      if (options.includeExternals) {
        args.push('--include-externals');
      }

      if (options.revision !== undefined && options.revision !== null && options.revision !== '') {
        args.push('--revision', String(options.revision));
      }

      if (target) {
        args.push(resolveSvnTarget(target, this.config).value);
      }

      const response = await executeSvnCommand(this.config, args);
      const raw = cleanOutput(response.data as string);
      const entries = parseListOutput(raw, !!options.verbose);

      return {
        success: true,
        data: { entries, raw },
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime
      };

    } catch (error: any) {
      this.handleSvnError(error, 'list directory (svn list)');
    }
  }
} 