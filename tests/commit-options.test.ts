import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { SvnService } from '../tools/svn-service.js';

function hasSvnTools(): boolean {
  try {
    execFileSync('svnadmin', ['--version', '--quiet'], { stdio: 'ignore' });
    execFileSync('svn', ['--version', '--quiet'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const describeIfSvn = hasSvnTools() ? describe : describe.skip;

describeIfSvn('SvnService commit options', () => {
  let root: string;
  let workingCopy: string;
  let repoUrl: string;
  let svnService: SvnService;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'mcp-svn-commit-'));
    const repo = join(root, 'repo');
    workingCopy = join(root, 'wc');
    execFileSync('svnadmin', ['create', repo]);
    repoUrl = pathToFileURL(repo).href;
    execFileSync('svn', ['checkout', repoUrl, workingCopy, '--quiet']);
    svnService = new SvnService({ workingDirectory: workingCopy, timeout: 30000 });
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('should commit using a message file even when a message is also supplied', async () => {
    const file = join(workingCopy, 'a.txt');
    writeFileSync(file, 'a');
    await svnService.add(file);

    const messageFile = join(root, 'message.txt');
    writeFileSync(messageFile, 'Message from file\n\n- with <special> characters & multiple lines');

    const result = await svnService.commit({ message: 'placeholder', file: messageFile }, [file]);

    expect(result.success).toBe(true);
    expect(result.command).toContain('--file');
    expect(result.command).not.toContain('--message');

    const log = execFileSync('svn', ['log', '-l', '1', repoUrl], { encoding: 'utf8' });
    expect(log).toContain('Message from file');
    expect(log).not.toContain('placeholder');
  }, 30000);

  it('should commit using --message when no file is supplied', async () => {
    const file = join(workingCopy, 'b.txt');
    writeFileSync(file, 'b');
    await svnService.add(file);

    const result = await svnService.commit({ message: 'Inline message' }, [file]);

    expect(result.success).toBe(true);
    expect(result.command).toContain('--message');
    expect(result.command).not.toContain('--file');
  }, 30000);

  it('should include the SVN error output when a commit fails', async () => {
    const notVersioned = join(root, 'not-versioned.txt');
    writeFileSync(notVersioned, 'x');

    await expect(svnService.commit({ message: 'Should fail' }, [notVersioned])).rejects.toThrow(/E\d{6}/);
  }, 30000);
});
