# SVN MCP Server

A complete MCP (Model Context Protocol) server for Subversion (SVN) integration, designed to let AI agents manage SVN repositories efficiently.

## 🎯 Features

- ✅ **Basic repository operations**: info, status, log, diff, checkout, update
- ✅ **File management**: add, commit, delete, revert
- ✅ **Maintenance tools**: cleanup
- 🔄 **Branch management**: (In development)
- 🔄 **Advanced operations**: merge, switch, properties (In development)
- 🔄 **Analysis tools**: blame, conflict detection (In development)
- 🔄 **Batch operations**: (In development)

## 📋 Requirements

- **Node.js** >= 20
- **Subversion (SVN)** installed and available on PATH
- **TypeScript** (for development)

### 🔍 Detecting the SVN installation

#### Check whether SVN is installed

```bash
# Basic command to check SVN
svn --version

# Check the full path of the executable
where svn        # Windows
which svn        # Linux/Mac

# Check the full SVN client
svn --version --verbose
```

#### Expected output if SVN is correctly installed:

```
svn, version 1.14.x (r1876290)
   compiled Apr 13 2023, 17:22:07 on x86_64-pc-mingw32

Copyright (C) 2023 The Apache Software Foundation.
This software consists of contributions made by many people;
see the NOTICE file for more information.
Subversion is open source software, see http://subversion.apache.org/
```

#### ❌ Common errors if SVN is NOT installed:

```bash
# Windows
'svn' is not recognized as an internal or external command

# Linux/Mac
svn: command not found
bash: svn: command not found
```

#### 🛠️ Advanced diagnostics

```bash
# Check the system PATH
echo $PATH                    # Linux/Mac
echo %PATH%                   # Windows CMD
$env:PATH                     # Windows PowerShell

# Search for SVN executables on the system
find / -name "svn" 2>/dev/null           # Linux
Get-ChildItem -Path C:\ -Name "svn.exe" -Recurse -ErrorAction SilentlyContinue  # Windows PowerShell

# Check the specific client version
svn --version | head -1       # Get just the first line with the version
```

### 💾 Installing SVN on Windows

#### Option 1: Package managers

```bash
# Using Chocolatey (Recommended)
choco install subversion

# Using winget
winget install CollabNet.Subversion

# Using Scoop
scoop install subversion
```

#### Option 2: Official installers

1. **TortoiseSVN** (includes the command-line client):
   ```
   https://tortoisesvn.net/downloads.html
   ✅ Includes GUI and CLI clients
   ✅ Windows Explorer integration
   ```

2. **SlikSVN** (command line only):
   ```
   https://sliksvn.com/download/
   ✅ Lightweight (CLI only)
   ✅ Ideal for automation
   ```

3. **CollabNet Subversion**:
   ```
   https://www.collab.net/downloads/subversion
   ✅ Enterprise version
   ✅ Commercial support available
   ```

#### Option 3: Visual Studio or Git for Windows

```bash
# If you have Git for Windows installed, it can include SVN
git svn --version

# Visual Studio can also include SVN
# Go to: Visual Studio Installer > Modify > Individual Components > Subversion
```

### 🐧 Installing SVN on Linux

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install subversion

# CentOS/RHEL/Fedora
sudo yum install subversion        # CentOS 7
sudo dnf install subversion        # CentOS 8/Fedora

# Arch Linux
sudo pacman -S subversion

# Alpine Linux
sudo apk add subversion
```

### 🍎 Installing SVN on macOS

```bash
# Homebrew (Recommended)
brew install subversion

# MacPorts
sudo port install subversion

# From Xcode Command Line Tools (may already be included)
xcode-select --install
```

### 🔧 Configuring SVN after installation

#### Check the global configuration

```bash
# Show current configuration
svn config --list

# Configure the global user
svn config --global auth:username your_username

# Configure the default editor
svn config --global editor "code --wait"     # VS Code
svn config --global editor "notepad"         # Windows Notepad
svn config --global editor "nano"            # Linux/Mac nano
```

#### Check repository access

```bash
# Test connection to a repository (without checking out)
svn list https://svn.example.com/repo/trunk

# Test with specific credentials
svn list https://svn.example.com/repo/trunk --username user --password password
```

## 🚀 Installation

### From NPM

```bash
npm install -g @grec0/mcp-svn
```

### Local Development

```bash
git clone https://github.com/gcorroto/mcp-svn.git
cd mcp-svn
npm install
npm run build
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SVN_PATH` | Path to the SVN executable | `svn` |
| `SVN_WORKING_DIRECTORY` | Local working copy directory | `process.cwd()` |
| `SVN_URL` (alias: `SVN_REPOSITORY_URL`) | Repository URL. Enables URL-only workflows and `/trunk/...` target resolution | - |
| `SVN_USERNAME` | Authentication user | - |
| `SVN_PASSWORD` | Authentication password | - |
| `SVN_TIMEOUT` | Timeout in milliseconds | `30000` |

`SVN_WORKING_DIRECTORY` and `SVN_URL` are independent — set either or both. With both configured, local operations (`svn_status`, `svn_commit`, ...) run in the working copy, and URL-capable tools (`svn_cat`, `svn_list`, `svn_info`, `svn_log`, `svn_diff`) can be called with:

- a full URL (`https://svn.example.com/repo/trunk/file.sql`)
- a repo-relative path starting with `/` (`/trunk/file.sql`) — joined with `SVN_URL`
- a local path — resolved against the working copy

### Example MCP Configuration

```json
{
  "mcpServers": {
    "svn": {
      "command": "npx",
      "args": ["@grec0/mcp-svn"],
      "env": {
        "SVN_PATH": "svn",
        "SVN_WORKING_DIRECTORY": "C:/path/to/working/copy",
        "SVN_URL": "https://svn.example.com/repo",
        "SVN_USERNAME": "your_username",
        "SVN_PASSWORD": "your_password"
      }
    }
  }
}
```

## 🛠️ Available Tools

### Basic Operations

#### `svn_health_check`
Check the health status of the SVN system and working copy.

```
svn_health_check()
```

#### `svn_info`
Get detailed information about the working copy or a specific file.

```
svn_info(path?: string)
```

#### `svn_status`
Show the status of files in the working copy.

```
svn_status(path?: string, showAll?: boolean)
```

#### `svn_log`
Show the commit history of the repository.

```
svn_log(path?: string, limit?: number, revision?: string)
```

#### `svn_diff`
Show differences between file revisions.

```
svn_diff(path?: string, oldRevision?: string, newRevision?: string)
```

### Repository Operations

#### `svn_checkout`
Check out an SVN repository.

```
svn_checkout(
  url: string,
  path?: string,
  revision?: number | "HEAD",
  depth?: "empty" | "files" | "immediates" | "infinity",
  force?: boolean,
  ignoreExternals?: boolean
)
```

#### `svn_update`
Update the working copy from the repository.

```
svn_update(
  path?: string,
  revision?: number | "HEAD" | "BASE" | "COMMITTED" | "PREV",
  force?: boolean,
  ignoreExternals?: boolean,
  acceptConflicts?: "postpone" | "base" | "mine-conflict" | "theirs-conflict" | "mine-full" | "theirs-full"
)
```

### File Management

#### `svn_add`
Add files to version control.

```
svn_add(
  paths: string | string[],
  force?: boolean,
  noIgnore?: boolean,
  parents?: boolean,
  autoProps?: boolean,
  noAutoProps?: boolean
)
```

#### `svn_commit`
Commit changes to the repository.

```
svn_commit(
  message: string,
  paths?: string[],
  file?: string,
  force?: boolean,
  keepLocks?: boolean,
  noUnlock?: boolean
)
```

#### `svn_delete`
Remove files from version control.

```
svn_delete(
  paths: string | string[],
  message?: string,
  force?: boolean,
  keepLocal?: boolean
)
```

#### `svn_revert`
Revert local changes on files.

```
svn_revert(paths: string | string[])
```

### Maintenance Tools

#### `svn_cleanup`
Clean up the working copy from interrupted operations.

```
svn_cleanup(path?: string)
```

## 📖 Usage Examples

### Check the system status

```javascript
// Check that SVN is available and the working copy is valid
const healthCheck = await svn_health_check();
```

### Get repository information

```javascript
// General working copy information
const info = await svn_info();

// Information about a specific file
const fileInfo = await svn_info("src/main.js");
```

### Show file status

```javascript
// Status of all files
const status = await svn_status();

// Status including remote information
const fullStatus = await svn_status(null, true);
```

### Check out a repository

```javascript
const checkout = await svn_checkout(
  "https://svn.example.com/repo/trunk",
  "local-copy",
  "HEAD",
  "infinity",
  false,
  false
);
```

### Commit changes

```javascript
// Add files
await svn_add(["src/new-file.js", "docs/readme.md"], { parents: true });

// Commit
await svn_commit(
  "Add new feature and documentation",
  ["src/new-file.js", "docs/readme.md"]
);
```

## 🧪 Testing

```bash
# Run tests
npm test

# Tests with coverage
npm run test -- --coverage

# Tests in watch mode
npm run test -- --watch
```

## 🏗️ Development

### Available scripts

```bash
# Build TypeScript
npm run build

# Development mode
npm run dev

# Watch mode
npm run watch

# MCP Inspector
npm run inspector

# Tests
npm test
```

### Releasing

- Patch versions are incremented automatically by CI on pushes to `main`.
- Run `npm run release:minor` for a minor release.
- Run `npm run release:major` for a major release.
- Packages are published to npm exclusively by CI.

### Project structure

```
svn-mcp/
├── package.json
├── tsconfig.json
├── jest.config.js
├── index.ts
├── common/
│   ├── types.ts      # TypeScript types
│   ├── utils.ts      # SVN utilities
│   └── version.ts    # Package version
├── tools/
│   └── svn-service.ts # Main SVN service
├── tests/
│   └── integration.test.ts # Integration tests
└── README.md
```

## 📊 Development Status

See the [SVN_MCP_IMPLEMENTATION.md](./SVN_MCP_IMPLEMENTATION.md) file for the full implementation checklist.

**Current progress:** Stage 1 complete (Basic Operations) ✅

**Next stages:**
- Branch management (branching)
- Advanced operations (merge, switch)
- Analysis tools
- Batch operations

## 🐛 Troubleshooting

### SVN not found

```
Error: SVN is not available in the system PATH
```

**Solution:** Install SVN and make sure it is on the system PATH.

### Not a working copy

```
Error: Failed to get SVN info: svn: warning: W155007: '.' is not a working copy
```

**Solution:** Navigate to a directory that is an SVN working copy or run checkout first.

### Authentication issues

```
Error: svn: E170001: Authentication failed
```

**Solution:** Set the `SVN_USERNAME` and `SVN_PASSWORD` environment variables.

### Timeouts on long operations

```
Error: Command timeout after 30000ms
```

**Solution:** Increase the value of `SVN_TIMEOUT`.

## 📄 License

MIT License - see [LICENSE](LICENSE) for more details.

## 🤝 Contributing

1. Fork the project
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Open a Pull Request

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/gcorroto/mcp-svn/issues)
- **Documentation:** [Project Wiki](https://github.com/gcorroto/mcp-svn/wiki)
- **Email:** soporte@grec0.dev
