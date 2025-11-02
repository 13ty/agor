# IDE Integration for Worktrees

Related: [[worktrees]], [[architecture]], [[environment-logs-and-mcp]]

**Status:** Exploration → Recommendation: Remote SSH
**Date:** January 2025

---

## Executive Summary

This exploration evaluates two approaches for IDE integration with Agor worktrees:

1. **VS Code Remote SSH** (RECOMMENDED) - Users connect their local IDE to worktrees via SSH
2. **code-server** (OPTIONAL) - Browser-based VS Code for iPad/no-install scenarios

### Key Findings

**Remote SSH is the better default approach:**

- ✅ **Zero infrastructure** - just provide SSH connection info
- ✅ **User's familiar IDE** - all settings, extensions, credentials already configured
- ✅ **Works with any IDE** - VS Code, JetBrains, Vim, Emacs
- ✅ **Better performance** - native app vs browser
- ✅ **No state management** - user's local config, not Agor's problem

**code-server only makes sense for:**

- iPad/Chromebook/tablet users
- Public computers without IDE installed
- Users who specifically want browser-based access

**Recommendation:** Implement Remote SSH connection info display as primary feature. Consider code-server as advanced/optional feature for specific use cases.

---

## Approach 1: Remote SSH (Recommended)

### Overview

Users connect their local IDE (VS Code, JetBrains, etc.) to Agor worktrees via SSH. This is the standard "remote development" workflow used by millions of developers.

### How It Works

**VS Code Remote SSH:**

1. User installs "Remote - SSH" extension (if not already installed)
2. User clicks "Connect to IDE" in Agor UI → shows SSH connection info
3. User adds SSH host to their local IDE
4. VS Code connects, installs VS Code Server on remote machine
5. User works in their local IDE, all code execution happens remotely

**Architecture:**

```
User's Local VS Code
  ↓ (SSH connection)
Remote Machine: VS Code Server + Worktree Files
```

### What Agor Needs to Provide

**Minimal implementation:**

```tsx
// Show in WorktreeCard or modal
<Card title="Connect Your IDE">
  <Typography.Paragraph>
    Connect VS Code or any SSH-compatible IDE to this worktree:
  </Typography.Paragraph>

  <Alert
    message="SSH Connection"
    description={
      <pre>
        ssh {user}@{hostname} -p {port}
        cd {worktreePath}
      </pre>
    }
    type="info"
    icon={<CodeOutlined />}
  />

  <Typography.Paragraph>
    <strong>VS Code:</strong> Install "Remote - SSH" extension, then add this host to your SSH
    config.
  </Typography.Paragraph>

  <Button
    icon={<CopyOutlined />}
    onClick={() => {
      navigator.clipboard.writeText(sshCommand);
      message.success('Copied SSH command');
    }}
  >
    Copy SSH Command
  </Button>
</Card>
```

### SSH Config Generation

**Even simpler - generate SSH config for user:**

```typescript
// Generate SSH config entry for worktree
function generateSSHConfig(worktree: Worktree): string {
  return `
Host agor-${worktree.name}
  HostName ${getHostname()}
  User ${getUsername()}
  Port ${getSSHPort()}
  IdentityFile ~/.ssh/id_rsa
  # Open directly in worktree
  RemoteCommand cd ${worktree.path} && exec $SHELL
  RequestTTY yes
`.trim();
}
```

**UI:**

```tsx
<Card title="Connect Your IDE">
  <Steps>
    <Step
      title="Copy SSH Config"
      description={
        <>
          <pre>{generateSSHConfig(worktree)}</pre>
          <Button onClick={copyConfig}>Copy to Clipboard</Button>
        </>
      }
    />
    <Step title="Add to ~/.ssh/config" description="Paste the config into your SSH config file" />
    <Step
      title="Connect in VS Code"
      description={<>Open VS Code → Remote SSH: Connect to Host → Select "agor-{worktree.name}"</>}
    />
  </Steps>
</Card>
```

### User Experience

**First time setup:**

```
1. User clicks "Connect IDE" on worktree
2. Agor shows SSH config + instructions
3. User copies config to ~/.ssh/config
4. User opens VS Code → Remote SSH: Connect
5. Done! Working in their own IDE with all their settings
```

**Subsequent connections:**

```
1. User opens VS Code
2. Clicks "agor-my-worktree" from recent connections
3. Done!
```

### Advantages

1. **Zero infrastructure** - No processes to spawn, no proxying, no lifecycle management
2. **User's environment** - All settings, extensions, themes, keybindings "just work"
3. **Git credentials** - Already configured on user's machine
4. **Any IDE** - Works with VS Code, JetBrains, Vim/Neovim (via scp), Emacs
5. **Performance** - Native app, better than browser
6. **Terminal users** - Can just SSH directly without IDE

### SSH Server Requirements

**Agor needs SSH access to worktree machine:**

**Option A: Local development (localhost)**

- SSH server already running on user's machine
- Just provide connection info for localhost
- Port: 22 (or custom)

**Option B: Remote server (cloud/VPS)**

- Agor daemon runs on server with SSH access
- Provide server hostname + credentials
- Worktrees accessible via SSH

**Option C: Per-worktree containers (future)**

- Each worktree runs in Docker container with SSH
- Dynamic port allocation (like Environment pattern)
- Agor manages container lifecycle

### Implementation Complexity

**Frontend:**

- Display SSH connection info (trivial)
- Copy to clipboard button
- Optional: SSH config generator
- Optional: VS Code deep link (`vscode://vscode-remote/ssh-remote+host/path`)

**Backend:**

- Return SSH connection info via API
- No process management, no proxying

**Total complexity: ~100 lines of code** vs thousands for code-server

### Limitations

1. **Requires SSH access** - User needs SSH server running (but most devs already have this)
2. **No browser-based option** - Can't use from iPad/Chromebook/public computers
3. **User must install IDE** - Not zero-install like code-server

---

## Approach 2: code-server (Optional/Advanced)

### Overview

Browser-based VS Code running on the server. Useful for specific scenarios where Remote SSH doesn't work.

### When to Use code-server

**Valid use cases:**

- User on iPad/Chromebook/tablet (no native IDE)
- Public/shared computer (can't install VS Code)
- User specifically wants browser-based access
- Team wants "click to code" with zero setup

**NOT recommended for:**

- Users with local IDE installed (Remote SSH is better)
- Users who heavily customize their IDE (settings don't sync)
- Primary development workflow (performance, UX worse than native)

### Background Research

### What is code-server?

**code-server** is a patched fork of VS Code that runs in the browser, developed by [Coder](https://coder.com). It provides:

- ✅ **Full IDE**: Complete VS Code experience (editor, file tree, terminal, debugger)
- ✅ **Extension support**: VS Code marketplace extensions work natively
- ✅ **Self-hosted**: Runs on your infrastructure, not Microsoft's cloud
- ✅ **Browser-based**: Access from any device via web browser
- ✅ **Written in TypeScript** (81.3% of codebase)

### code-server vs OpenVSCode Server

| Feature               | code-server (Coder)                            | OpenVSCode Server (Gitpod)             |
| --------------------- | ---------------------------------------------- | -------------------------------------- |
| **GitHub Stars**      | 74,500+ ⭐                                     | 5,600                                  |
| **Community**         | 244 contributors, mature ecosystem             | 99 releases, enterprise backing        |
| **Architecture**      | Patched fork (patch files on VS Code)          | Direct fork (minimal modifications)    |
| **Updates**           | Lags behind VS Code releases slightly          | Same-day updates with upstream VS Code |
| **Features**          | Auth, TLS, pre-install extensions, proxying    | Pure VS Code, minimal additions        |
| **Extension install** | ✅ Pre-install during Docker build             | ❌ Interactive only                    |
| **Philosophy**        | Enhanced self-hosted experience                | "Upstream as possible"                 |
| **Best for Agor**     | ✅ Better process management, larger community | Lighter, purer VS Code                 |

**Recommendation:** **code-server** for Agor due to:

- Larger community (13x more stars) = more troubleshooting resources
- Better features for dynamic spawning (pre-install extensions, auth options)
- Battle-tested in production environments
- Docker-friendly for future containerization

### Multi-User Architecture

**Critical Finding:** Both code-server and OpenVSCode Server are **single-user, single-workspace** by design.

From official docs:

> "If you want to run multiple code-servers on shared infrastructure, we recommend using virtual machines (provide one VM per user)."

**Deployment pattern for multi-user/multi-workspace:**

- ❌ NOT: One instance serves all users (multi-tenancy not supported)
- ✅ YES: One instance per user/workspace (process isolation)

**This matches Agor's Environment pattern perfectly!**

---

## Agor Architecture Integration

### Current Environment Pattern

Agor already spawns processes per worktree for agent environments:

```typescript
// Current: Environment = shell/agent process per worktree
export const environments = sqliteTable('environments', {
  id: text('id').primaryKey(),
  worktreeId: text('worktree_id')
    .notNull()
    .references(() => worktrees.id),
  port: integer('port').notNull(),
  pid: integer('pid'),
  status: text('status'), // 'starting' | 'running' | 'stopped'
});
```

### Proposed IDE Pattern

**Same architecture, different process:**

```typescript
// Proposed: IDE instance = code-server process per worktree
export const ideInstances = sqliteTable('ide_instances', {
  id: text('id').primaryKey(),
  worktreeId: text('worktree_id')
    .notNull()
    .references(() => worktrees.id),
  port: integer('port').notNull(), // Dynamic: 8080 + hash(worktreeId)
  pid: integer('pid'), // Process ID for lifecycle management
  status: text('status').notNull(), // 'starting' | 'running' | 'stopped' | 'failed'
  codeServerVersion: text('code_server_version'), // e.g., "4.105.1"
  startedAt: integer('started_at', { mode: 'timestamp' }),
  stoppedAt: integer('stopped_at', { mode: 'timestamp' }),
});
```

**Key similarities:**

1. One instance per worktree
2. Dynamic port allocation
3. Process lifecycle tracking (spawn, monitor, cleanup)
4. Database-backed state management

---

## Technical Implementation

### 1. code-server CLI Interface

**Basic command:**

```bash
code-server [workspace-path] --bind-addr <host:port> [flags]
```

**Example for Agor:**

```bash
code-server ~/.agor/worktrees/org/repo/main \
  --bind-addr 127.0.0.1:8081 \
  --auth none \
  --disable-telemetry \
  --user-data-dir ~/.agor/ide-data/worktree-123
```

**Key flags:**

- `--bind-addr 127.0.0.1:PORT` - Host and port binding
- `--auth none` - Disable auth (Agor daemon handles authentication)
- `--user-data-dir PATH` - Separate VS Code settings per worktree
- `--disable-telemetry` - No telemetry sent to Microsoft
- `--disable-getting-started-override` - Remove Coder branding

**Alternative (environment variable):**

```bash
PORT=8081 code-server ~/.agor/worktrees/org/repo/main --auth none
```

### 2. Process Spawning (Daemon)

```typescript
// packages/core/src/services/ide-manager.ts

import { spawn, ChildProcess } from 'child_process';
import { getIDEInstanceRepository } from '@agor/core/db/repositories';
import type { WorktreeID, IDEInstanceID } from '@agor/core/types';

export interface SpawnIDEOptions {
  worktreeId: WorktreeID;
  worktreePath: string;
  port: number;
  userDataDir?: string;
}

export class IDEManager {
  private instances = new Map<IDEInstanceID, ChildProcess>();

  async spawnIDE(options: SpawnIDEOptions): Promise<IDEInstanceID> {
    const { worktreeId, worktreePath, port, userDataDir } = options;

    // Generate user data directory
    const dataDir = userDataDir || path.join(os.homedir(), '.agor', 'ide-data', worktreeId);

    // Ensure data directory exists
    await fs.mkdir(dataDir, { recursive: true });

    // Spawn code-server process
    const proc = spawn(
      'code-server',
      [
        worktreePath,
        '--bind-addr',
        `127.0.0.1:${port}`,
        '--auth',
        'none',
        '--disable-telemetry',
        '--disable-getting-started-override',
        '--user-data-dir',
        dataDir,
      ],
      {
        stdio: 'pipe',
        env: {
          ...process.env,
          NODE_ENV: 'production',
        },
      }
    );

    // Create database record
    const instance = await getIDEInstanceRepository().create({
      worktreeId,
      port,
      pid: proc.pid,
      status: 'starting',
      startedAt: new Date(),
    });

    // Track process
    this.instances.set(instance.id, proc);

    // Handle process lifecycle
    proc.stdout?.on('data', data => {
      console.log(`[IDE ${instance.id}] ${data.toString()}`);
    });

    proc.stderr?.on('data', data => {
      console.error(`[IDE ${instance.id}] ${data.toString()}`);
    });

    proc.on('spawn', async () => {
      console.log(`✅ IDE instance started: ${instance.id} on port ${port}`);
      await getIDEInstanceRepository().update(instance.id, {
        status: 'running',
      });
    });

    proc.on('error', async error => {
      console.error(`❌ IDE instance failed: ${instance.id}`, error);
      await getIDEInstanceRepository().update(instance.id, {
        status: 'failed',
      });
    });

    proc.on('exit', async (code, signal) => {
      console.log(`🛑 IDE instance exited: ${instance.id} (code: ${code}, signal: ${signal})`);
      await getIDEInstanceRepository().update(instance.id, {
        status: 'stopped',
        stoppedAt: new Date(),
      });
      this.instances.delete(instance.id);
    });

    return instance.id;
  }

  async stopIDE(instanceId: IDEInstanceID): Promise<void> {
    const proc = this.instances.get(instanceId);
    if (!proc) {
      throw new Error(`No process found for IDE instance: ${instanceId}`);
    }

    // Graceful shutdown
    proc.kill('SIGTERM');

    // Force kill after 5 seconds
    setTimeout(() => {
      if (!proc.killed) {
        console.warn(`⚠️  Force killing IDE instance: ${instanceId}`);
        proc.kill('SIGKILL');
      }
    }, 5000);
  }

  async getStatus(instanceId: IDEInstanceID): Promise<'running' | 'stopped'> {
    const proc = this.instances.get(instanceId);
    return proc && !proc.killed ? 'running' : 'stopped';
  }
}
```

### 3. Dynamic Port Allocation

```typescript
// packages/core/src/services/ide-port-allocator.ts

import type { WorktreeID } from '@agor/core/types';

const IDE_PORT_BASE = 8080;
const IDE_PORT_RANGE = 1000; // Support up to 1000 concurrent IDE instances

/**
 * Generate deterministic port from worktree ID
 * Ensures same worktree always gets same port (idempotent)
 */
export function allocateIDEPort(worktreeId: WorktreeID): number {
  // Hash worktree ID to number
  const hash = worktreeId.split('').reduce((acc, char) => {
    return (acc << 5) - acc + char.charCodeAt(0);
  }, 0);

  // Map to port range
  const offset = Math.abs(hash) % IDE_PORT_RANGE;
  return IDE_PORT_BASE + offset;
}

/**
 * Check if port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(true);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port, '127.0.0.1');
  });
}

/**
 * Find available port for IDE instance
 * Falls back to next available if primary is taken
 */
export async function findAvailableIDEPort(worktreeId: WorktreeID): Promise<number> {
  const primaryPort = allocateIDEPort(worktreeId);

  if (await isPortAvailable(primaryPort)) {
    return primaryPort;
  }

  // Find next available port
  for (let offset = 1; offset < 100; offset++) {
    const port = primaryPort + offset;
    if (await isPortAvailable(port)) {
      console.warn(`⚠️  Primary port ${primaryPort} taken, using ${port}`);
      return port;
    }
  }

  throw new Error(`No available ports found near ${primaryPort}`);
}
```

### 4. Express Proxy Setup

```typescript
// apps/agor-daemon/src/services/ide-proxy.ts

import { createProxyMiddleware } from 'http-proxy-middleware';
import type { Application } from '@feathersjs/express';
import { getIDEInstanceRepository } from '@agor/core/db/repositories';

export function setupIDEProxy(app: Application) {
  const ideRepo = getIDEInstanceRepository();

  // Create dynamic proxy middleware
  const ideProxy = createProxyMiddleware({
    target: 'http://localhost', // Base target (overridden by router)
    changeOrigin: true,
    ws: true, // Enable WebSocket proxying (critical for VS Code)

    // Dynamic routing based on worktree ID
    router: async req => {
      // Extract worktree ID from path: /ide/worktree-123/...
      const match = req.url?.match(/^\/ide\/([^\/]+)/);
      if (!match) {
        throw new Error('Invalid IDE URL - no worktree ID');
      }

      const worktreeId = match[1];

      // Lookup IDE instance for this worktree
      const instance = await ideRepo.findByWorktreeId(worktreeId);

      if (!instance || instance.status !== 'running') {
        throw new Error(`No IDE instance running for worktree ${worktreeId}`);
      }

      // Return target with dynamic port
      return `http://127.0.0.1:${instance.port}`;
    },

    // Rewrite path to remove /ide/worktree-id prefix
    pathRewrite: (path, req) => {
      return path.replace(/^\/ide\/[^\/]+/, '');
    },

    // Error handling
    onError: (err, req, res) => {
      console.error('IDE proxy error:', err);

      if (res.headersSent) {
        return;
      }

      res.status(502).json({
        error: 'IDE instance not available',
        message: err.message,
      });
    },

    // Logging
    onProxyReq: (proxyReq, req, res) => {
      console.log(`[IDE Proxy] ${req.method} ${req.url} → ${proxyReq.path}`);
    },
  });

  // Register proxy middleware
  app.use('/ide', ideProxy);

  console.log('✅ IDE proxy registered at /ide/:worktreeId');
}
```

### 5. WebSocket Upgrade Handling

```typescript
// apps/agor-daemon/src/index.ts

import http from 'http';
import express from 'express';
import { setupIDEProxy } from './services/ide-proxy';

const app = express(feathers());

// ... existing FeathersJS setup ...

// Register IDE proxy
setupIDEProxy(app);

// Create HTTP server (if not already using http.createServer)
const server = http.createServer(app);

// CRITICAL: Handle WebSocket upgrade events for IDE
server.on('upgrade', (req, socket, head) => {
  if (req.url?.startsWith('/ide/')) {
    // Let http-proxy-middleware handle the upgrade
    // (it registers its own upgrade handler internally)
    console.log(`[WebSocket] Upgrading connection for ${req.url}`);
  }
});

server.listen(3030, () => {
  console.log('🚀 Agor daemon listening on port 3030');
});
```

**Why WebSocket support is critical:**

- VS Code uses WebSockets for terminal, debugging, and real-time features
- Without `ws: true`, terminal and debugger won't work
- The `upgrade` event must be handled at the HTTP server level

---

## Data Model

### IDE Instance Table

```typescript
// packages/core/src/db/schema.ts

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { worktrees } from './worktrees';

export const ideInstances = sqliteTable('ide_instances', {
  id: text('id').primaryKey(), // UUIDv7
  worktreeId: text('worktree_id')
    .notNull()
    .references(() => worktrees.id, { onDelete: 'cascade' })
    .unique(), // One IDE per worktree

  port: integer('port').notNull(),
  pid: integer('pid'), // Process ID

  status: text('status').notNull(), // 'starting' | 'running' | 'stopped' | 'failed'

  codeServerVersion: text('code_server_version'),

  startedAt: integer('started_at', { mode: 'timestamp' }),
  stoppedAt: integer('stopped_at', { mode: 'timestamp' }),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
```

### Type Definitions

```typescript
// packages/core/src/types/ide.ts

import type { WorktreeID, Timestamp, BrandedID } from './common';

export type IDEInstanceID = BrandedID<'IDEInstance'>;

export type IDEStatus = 'starting' | 'running' | 'stopped' | 'failed';

export interface IDEInstance {
  id: IDEInstanceID;
  worktreeId: WorktreeID;
  port: number;
  pid: number | null;
  status: IDEStatus;
  codeServerVersion: string | null;
  startedAt: Timestamp;
  stoppedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateIDEInstanceInput {
  worktreeId: WorktreeID;
  port: number;
  pid?: number;
  status: IDEStatus;
  codeServerVersion?: string;
  startedAt?: Date;
}

export interface UpdateIDEInstanceInput {
  status?: IDEStatus;
  pid?: number;
  stoppedAt?: Date;
}
```

### Repository

```typescript
// packages/core/src/db/repositories/ide-instances.ts

import { eq } from 'drizzle-orm';
import { getDatabase } from '../client';
import { ideInstances } from '../schema';
import type {
  IDEInstance,
  CreateIDEInstanceInput,
  UpdateIDEInstanceInput,
  WorktreeID,
  IDEInstanceID,
} from '@agor/core/types';
import { uuidv7 } from '@agor/core/utils/id';

export class IDEInstanceRepository {
  async create(input: CreateIDEInstanceInput): Promise<IDEInstance> {
    const db = getDatabase();
    const now = new Date();

    const instance: IDEInstance = {
      id: uuidv7() as IDEInstanceID,
      worktreeId: input.worktreeId,
      port: input.port,
      pid: input.pid || null,
      status: input.status,
      codeServerVersion: input.codeServerVersion || null,
      startedAt: input.startedAt || now,
      stoppedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(ideInstances).values(instance);

    return instance;
  }

  async findById(id: IDEInstanceID): Promise<IDEInstance | null> {
    const db = getDatabase();
    const rows = await db.select().from(ideInstances).where(eq(ideInstances.id, id));
    return rows[0] || null;
  }

  async findByWorktreeId(worktreeId: WorktreeID): Promise<IDEInstance | null> {
    const db = getDatabase();
    const rows = await db
      .select()
      .from(ideInstances)
      .where(eq(ideInstances.worktreeId, worktreeId));
    return rows[0] || null;
  }

  async update(id: IDEInstanceID, input: UpdateIDEInstanceInput): Promise<void> {
    const db = getDatabase();
    await db
      .update(ideInstances)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(ideInstances.id, id));
  }

  async delete(id: IDEInstanceID): Promise<void> {
    const db = getDatabase();
    await db.delete(ideInstances).where(eq(ideInstances.id, id));
  }

  async listRunning(): Promise<IDEInstance[]> {
    const db = getDatabase();
    return db.select().from(ideInstances).where(eq(ideInstances.status, 'running'));
  }
}

let repository: IDEInstanceRepository;

export function getIDEInstanceRepository(): IDEInstanceRepository {
  if (!repository) {
    repository = new IDEInstanceRepository();
  }
  return repository;
}
```

---

## FeathersJS Service

```typescript
// apps/agor-daemon/src/services/ide/ide.class.ts

import type { Params } from '@feathersjs/feathers';
import { IDEManager } from '@agor/core/services/ide-manager';
import { findAvailableIDEPort } from '@agor/core/services/ide-port-allocator';
import { getIDEInstanceRepository } from '@agor/core/db/repositories';
import { getWorktreeRepository } from '@agor/core/db/repositories';
import type { WorktreeID, IDEInstanceID } from '@agor/core/types';

export interface IDEServiceData {
  worktreeId: WorktreeID;
}

export class IDEService {
  private manager = new IDEManager();

  /**
   * Start IDE instance for worktree
   * POST /ide { worktreeId: '...' }
   */
  async create(data: IDEServiceData, params?: Params): Promise<{ id: IDEInstanceID; url: string }> {
    const { worktreeId } = data;

    // Check if IDE already running
    const existing = await getIDEInstanceRepository().findByWorktreeId(worktreeId);
    if (existing && existing.status === 'running') {
      return {
        id: existing.id,
        url: `/ide/${worktreeId}`,
      };
    }

    // Get worktree path
    const worktree = await getWorktreeRepository().findById(worktreeId);
    if (!worktree) {
      throw new Error(`Worktree not found: ${worktreeId}`);
    }

    // Allocate port
    const port = await findAvailableIDEPort(worktreeId);

    // Spawn IDE
    const instanceId = await this.manager.spawnIDE({
      worktreeId,
      worktreePath: worktree.path,
      port,
    });

    return {
      id: instanceId,
      url: `/ide/${worktreeId}`,
    };
  }

  /**
   * Stop IDE instance
   * DELETE /ide/:instanceId
   */
  async remove(id: IDEInstanceID, params?: Params): Promise<{ success: boolean }> {
    await this.manager.stopIDE(id);
    return { success: true };
  }

  /**
   * Get IDE instance status
   * GET /ide/:instanceId
   */
  async get(id: IDEInstanceID, params?: Params) {
    const instance = await getIDEInstanceRepository().findById(id);
    if (!instance) {
      throw new Error(`IDE instance not found: ${id}`);
    }

    return instance;
  }

  /**
   * List all IDE instances
   * GET /ide
   */
  async find(params?: Params) {
    return getIDEInstanceRepository().listRunning();
  }
}
```

```typescript
// apps/agor-daemon/src/services/ide/ide.service.ts

import { IDEService } from './ide.class';

export default function (app: Application) {
  app.use('/ide', new IDEService());
}
```

```typescript
// apps/agor-daemon/src/index.ts

import ide from './services/ide/ide.service';

app.configure(ide);
```

---

## Frontend Integration

### 1. Worktree Card - "Open IDE" Button

```tsx
// apps/agor-ui/src/components/WorktreeCard/WorktreeCard.tsx

import { CodeOutlined } from '@ant-design/icons';
import { Button, message } from 'antd';
import { useIDEService } from '@/hooks/useIDEService';

export function WorktreeCard({ worktree }: { worktree: Worktree }) {
  const { startIDE, loading } = useIDEService();

  const handleOpenIDE = async () => {
    try {
      const { url } = await startIDE(worktree.id);

      // Open in new tab
      window.open(url, '_blank');

      message.success('IDE opened in new tab');
    } catch (error) {
      message.error('Failed to open IDE');
      console.error(error);
    }
  };

  return (
    <Card>
      <div className="worktree-header">
        <h3>{worktree.name}</h3>
        <Space>
          {/* Existing buttons */}
          <Button icon={<TerminalOutlined />}>Terminal</Button>

          {/* NEW: IDE button */}
          <Button icon={<CodeOutlined />} onClick={handleOpenIDE} loading={loading}>
            Open IDE
          </Button>
        </Space>
      </div>
      {/* ... rest of card ... */}
    </Card>
  );
}
```

### 2. IDE Service Hook

```typescript
// apps/agor-ui/src/hooks/useIDEService.ts

import { useState } from 'react';
import { useFeathers } from '@/hooks/useFeathers';
import type { WorktreeID } from '@agor/core/types';

export function useIDEService() {
  const { client } = useFeathers();
  const [loading, setLoading] = useState(false);

  const startIDE = async (worktreeId: WorktreeID): Promise<{ id: string; url: string }> => {
    setLoading(true);
    try {
      const result = await client.service('ide').create({ worktreeId });
      return result;
    } finally {
      setLoading(false);
    }
  };

  const stopIDE = async (instanceId: string): Promise<void> => {
    setLoading(true);
    try {
      await client.service('ide').remove(instanceId);
    } finally {
      setLoading(false);
    }
  };

  return { startIDE, stopIDE, loading };
}
```

### 3. IDE Status Indicator (Optional)

```tsx
// apps/agor-ui/src/components/WorktreeCard/IDEStatus.tsx

import { Badge } from 'antd';
import { useIDEInstance } from '@/hooks/useIDEInstance';

export function IDEStatus({ worktreeId }: { worktreeId: WorktreeID }) {
  const { instance } = useIDEInstance(worktreeId);

  if (!instance) return null;

  const statusColor = {
    starting: 'processing',
    running: 'success',
    stopped: 'default',
    failed: 'error',
  }[instance.status];

  return <Badge status={statusColor} text={`IDE: ${instance.status}`} />;
}
```

### 4. Real-Time WebSocket Updates

```typescript
// apps/agor-ui/src/hooks/useIDEInstance.ts

import { useEffect, useState } from 'react';
import { useFeathers } from '@/hooks/useFeathers';
import type { IDEInstance, WorktreeID } from '@agor/core/types';

export function useIDEInstance(worktreeId: WorktreeID) {
  const { client } = useFeathers();
  const [instance, setInstance] = useState<IDEInstance | null>(null);

  useEffect(() => {
    // Initial fetch
    const fetchInstance = async () => {
      try {
        const instances = await client.service('ide').find({
          query: { worktreeId },
        });
        setInstance(instances[0] || null);
      } catch (error) {
        console.error('Failed to fetch IDE instance:', error);
      }
    };

    fetchInstance();

    // Listen for updates
    const handleUpdated = (updated: IDEInstance) => {
      if (updated.worktreeId === worktreeId) {
        setInstance(updated);
      }
    };

    const handleRemoved = (removed: IDEInstance) => {
      if (removed.worktreeId === worktreeId) {
        setInstance(null);
      }
    };

    client.service('ide').on('updated', handleUpdated);
    client.service('ide').on('removed', handleRemoved);

    return () => {
      client.service('ide').off('updated', handleUpdated);
      client.service('ide').off('removed', handleRemoved);
    };
  }, [worktreeId]);

  return { instance };
}
```

---

## User Experience Flow

### 1. Opening IDE

```
User clicks "Open IDE" on Worktree card
  ↓
Frontend: POST /ide { worktreeId: '...' }
  ↓
Backend: Check if IDE already running for this worktree
  ├─ Yes: Return existing instance URL
  └─ No: Spawn new code-server process
      ↓
      Allocate port (deterministic from worktree ID)
      ↓
      Spawn: code-server ~/.agor/worktrees/org/repo/main --bind-addr 127.0.0.1:8081 ...
      ↓
      Create database record (status: 'starting')
      ↓
      Wait for process to spawn
      ↓
      Update status to 'running'
      ↓
      Return: { id: '...', url: '/ide/worktree-123' }
  ↓
Frontend: window.open('/ide/worktree-123', '_blank')
  ↓
New tab opens → Request hits daemon → Proxy routes to port 8081 → VS Code loads
```

### 2. Using IDE

```
User edits files in VS Code
  ↓
Changes saved to ~/.agor/worktrees/org/repo/main
  ↓
Git detects changes (same as any file edit)
  ↓
Agor shows uncommitted changes in Worktree card
```

### 3. Closing IDE

**Manual cleanup:**

```
User closes IDE tab
  ↓
(Process continues running in background)
  ↓
User clicks "Stop IDE" button (optional)
  ↓
Frontend: DELETE /ide/:instanceId
  ↓
Backend: SIGTERM to process → graceful shutdown
```

**Automatic cleanup (on worktree delete):**

```
User deletes worktree
  ↓
Backend: CASCADE delete IDE instance
  ↓
Foreign key trigger → Stop associated IDE process
```

---

## Configuration & Settings

### 1. Global Settings

```yaml
# ~/.agor/config.yaml

ide:
  enabled: true
  port_base: 8080 # Base port for IDE instances
  port_range: 1000 # Support up to 1000 concurrent IDEs
  auto_start: false # Auto-start IDE when worktree created
  auto_stop_timeout: 3600 # Auto-stop after 1 hour of inactivity (seconds)
```

### 2. Pre-installed Extensions

```typescript
// packages/core/src/services/ide-manager.ts

const DEFAULT_EXTENSIONS = [
  'dbaeumer.vscode-eslint',
  'esbenp.prettier-vscode',
  'ms-vscode.vscode-typescript-next',
  // Add more default extensions
];

async function installExtensions(dataDir: string): Promise<void> {
  for (const extension of DEFAULT_EXTENSIONS) {
    await exec(`code-server --install-extension ${extension} --user-data-dir ${dataDir}`);
  }
}
```

### 3. Per-Worktree Settings

```typescript
// Worktree can have custom IDE settings
export interface Worktree {
  // ... existing fields ...

  ideSettings?: {
    autoStart?: boolean;
    extensions?: string[]; // Additional extensions
    settings?: Record<string, unknown>; // VS Code settings.json
  };
}
```

---

## Lifecycle Management

### 1. Health Checks

```typescript
// packages/core/src/services/ide-health-checker.ts

export class IDEHealthChecker {
  async checkHealth(instance: IDEInstance): Promise<boolean> {
    try {
      const response = await fetch(`http://127.0.0.1:${instance.port}/healthz`, {
        timeout: 5000,
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async monitorAll(): Promise<void> {
    const instances = await getIDEInstanceRepository().listRunning();

    for (const instance of instances) {
      const isHealthy = await this.checkHealth(instance);

      if (!isHealthy && instance.status === 'running') {
        console.warn(`⚠️  IDE instance unhealthy: ${instance.id}`);

        // Update status
        await getIDEInstanceRepository().update(instance.id, {
          status: 'failed',
        });

        // Emit event for UI
        app.service('ide').emit('health:failed', instance);
      }
    }
  }
}

// Run health checks every 30 seconds
setInterval(() => {
  const healthChecker = new IDEHealthChecker();
  healthChecker.monitorAll();
}, 30000);
```

### 2. Auto-Stop After Inactivity

```typescript
// packages/core/src/services/ide-activity-tracker.ts

export class IDEActivityTracker {
  private lastActivity = new Map<IDEInstanceID, Date>();

  trackActivity(instanceId: IDEInstanceID): void {
    this.lastActivity.set(instanceId, new Date());
  }

  async checkInactivity(timeout: number = 3600): Promise<void> {
    const instances = await getIDEInstanceRepository().listRunning();
    const now = Date.now();

    for (const instance of instances) {
      const lastActive = this.lastActivity.get(instance.id);

      if (!lastActive) {
        // First check, mark as active
        this.lastActivity.set(instance.id, new Date());
        continue;
      }

      const inactiveDuration = (now - lastActive.getTime()) / 1000;

      if (inactiveDuration > timeout) {
        console.log(`⏰ Auto-stopping inactive IDE: ${instance.id}`);
        await new IDEManager().stopIDE(instance.id);
        this.lastActivity.delete(instance.id);
      }
    }
  }
}

// Track activity via proxy middleware
app.use('/ide', (req, res, next) => {
  const match = req.url?.match(/^\/([^\/]+)/);
  if (match) {
    const worktreeId = match[1];
    // Track activity
    activityTracker.trackActivityForWorktree(worktreeId);
  }
  next();
});
```

### 3. Cleanup on Daemon Shutdown

```typescript
// apps/agor-daemon/src/index.ts

process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down daemon...');

  // Stop all IDE instances gracefully
  const manager = new IDEManager();
  const instances = await getIDEInstanceRepository().listRunning();

  for (const instance of instances) {
    console.log(`Stopping IDE instance: ${instance.id}`);
    await manager.stopIDE(instance.id);
  }

  process.exit(0);
});
```

---

## Security Considerations

### 1. Authentication

**Issue:** code-server has its own auth system, but we're disabling it (`--auth none`)

**Solution:** Agor daemon handles auth via existing middleware

```typescript
// apps/agor-daemon/src/middleware/auth.ts

// Protect IDE routes with existing auth
app.use('/ide', authenticate('jwt')); // Or anonymous-first auth
```

### 2. Path Traversal Protection

**Issue:** Users could try to access arbitrary worktrees via URL manipulation

**Solution:** Validate worktree ownership in proxy router

```typescript
router: async req => {
  const worktreeId = extractWorktreeId(req.url);

  // Validate user has access to this worktree
  const user = req.user; // From auth middleware
  const worktree = await getWorktreeRepository().findById(worktreeId);

  if (!worktree || worktree.userId !== user.id) {
    throw new Error('Unauthorized access to worktree');
  }

  // ... rest of routing logic
};
```

### 3. Resource Limits

**Issue:** Users could spawn too many IDE instances, exhausting resources

**Solution:** Limit concurrent IDEs per user

```typescript
export class IDEService {
  async create(data: IDEServiceData, params?: Params) {
    const userId = params.user?.id;

    // Check user's running IDE count
    const userInstances = await getIDEInstanceRepository().findByUserId(userId);
    const runningCount = userInstances.filter(i => i.status === 'running').length;

    const MAX_CONCURRENT_IDES = 5; // Per user

    if (runningCount >= MAX_CONCURRENT_IDES) {
      throw new Error(`Maximum concurrent IDE instances reached (${MAX_CONCURRENT_IDES})`);
    }

    // ... spawn IDE
  }
}
```

### 4. Network Isolation

**Issue:** IDE instances bind to `127.0.0.1` but could be exposed

**Solution:** Ensure all instances bind to localhost only

```bash
# GOOD: Only accessible via daemon proxy
--bind-addr 127.0.0.1:8081

# BAD: Exposed to network
--bind-addr 0.0.0.0:8081
```

---

## Installation & Prerequisites

### 1. Install code-server

**macOS (Homebrew):**

```bash
brew install code-server
```

**Linux (install script):**

```bash
curl -fsSL https://code-server.dev/install.sh | sh
```

**npm (global):**

```bash
npm install -g code-server
```

**Verify installation:**

```bash
code-server --version
# Output: 4.105.1
```

### 2. Daemon Dependency Check

```typescript
// apps/agor-daemon/src/startup/check-dependencies.ts

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function checkCodeServerInstalled(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('code-server --version');
    console.log(`✅ code-server installed: ${stdout.trim()}`);
    return true;
  } catch {
    console.error('❌ code-server not installed');
    console.error('   Install: brew install code-server');
    return false;
  }
}

// Run on daemon startup
const hasCodeServer = await checkCodeServerInstalled();
if (!hasCodeServer) {
  console.warn('⚠️  IDE features will be disabled');
}
```

### 3. Required npm Packages

```json
// apps/agor-daemon/package.json
{
  "dependencies": {
    "http-proxy-middleware": "^3.0.0"
  }
}
```

---

## Testing Strategy

### 1. Unit Tests

```typescript
// packages/core/src/services/ide-port-allocator.test.ts

describe('allocateIDEPort', () => {
  it('returns deterministic port for same worktree ID', () => {
    const worktreeId = '019a3af2-d26b-7408-b689-cb319232e216';
    const port1 = allocateIDEPort(worktreeId);
    const port2 = allocateIDEPort(worktreeId);
    expect(port1).toBe(port2);
  });

  it('returns different ports for different worktrees', () => {
    const port1 = allocateIDEPort('019a3af2-d26b-7408-b689-cb319232e216');
    const port2 = allocateIDEPort('019a3af3-0000-0000-0000-000000000000');
    expect(port1).not.toBe(port2);
  });

  it('returns port within range', () => {
    const port = allocateIDEPort('019a3af2-d26b-7408-b689-cb319232e216');
    expect(port).toBeGreaterThanOrEqual(8080);
    expect(port).toBeLessThan(9080);
  });
});
```

### 2. Integration Tests

```typescript
// apps/agor-daemon/test/ide-service.test.ts

describe('IDE Service', () => {
  let app: Application;
  let worktree: Worktree;

  beforeEach(async () => {
    app = createApp();
    worktree = await createTestWorktree();
  });

  afterEach(async () => {
    // Cleanup spawned processes
    await cleanupIDEInstances();
  });

  it('spawns IDE instance for worktree', async () => {
    const result = await app.service('ide').create({
      worktreeId: worktree.id,
    });

    expect(result.id).toBeDefined();
    expect(result.url).toBe(`/ide/${worktree.id}`);

    // Verify instance is running
    const instance = await getIDEInstanceRepository().findById(result.id);
    expect(instance?.status).toBe('running');
  });

  it('returns existing instance if already running', async () => {
    const result1 = await app.service('ide').create({ worktreeId: worktree.id });
    const result2 = await app.service('ide').create({ worktreeId: worktree.id });

    expect(result1.id).toBe(result2.id);
  });

  it('stops IDE instance', async () => {
    const { id } = await app.service('ide').create({ worktreeId: worktree.id });

    await app.service('ide').remove(id);

    const instance = await getIDEInstanceRepository().findById(id);
    expect(instance?.status).toBe('stopped');
  });

  it('proxies requests to IDE instance', async () => {
    const { url } = await app.service('ide').create({ worktreeId: worktree.id });

    const response = await fetch(`http://localhost:3030${url}`);
    expect(response.ok).toBe(true);
    expect(response.headers.get('content-type')).toContain('text/html');
  });
});
```

### 3. E2E Tests (Playwright)

```typescript
// apps/agor-ui/tests/ide-integration.spec.ts

import { test, expect } from '@playwright/test';

test.describe('IDE Integration', () => {
  test('opens IDE in new tab', async ({ page, context }) => {
    await page.goto('/boards/default');

    // Click "Open IDE" on worktree card
    const ideButton = page.locator('button', { hasText: 'Open IDE' });

    const [newPage] = await Promise.all([context.waitForEvent('page'), ideButton.click()]);

    // Verify VS Code loaded
    await newPage.waitForLoadState('networkidle');
    expect(newPage.url()).toContain('/ide/');

    // Check for VS Code UI elements
    const editor = newPage.locator('.monaco-editor');
    await expect(editor).toBeVisible();
  });
});
```

---

## Migration Path

### Phase 1: Core Infrastructure (Week 1)

- [ ] Install code-server on dev/staging environments
- [ ] Implement `IDEManager` class for process spawning
- [ ] Implement port allocation logic
- [ ] Create `ide_instances` database table
- [ ] Implement IDE instance repository
- [ ] Test process spawning/stopping locally

### Phase 2: Proxy & Service (Week 2)

- [ ] Install `http-proxy-middleware` dependency
- [ ] Implement IDE proxy setup with dynamic routing
- [ ] Handle WebSocket upgrade events
- [ ] Create IDE FeathersJS service
- [ ] Test proxy routing to spawned instances
- [ ] Write unit tests for proxy logic

### Phase 3: Frontend Integration (Week 2-3)

- [ ] Add "Open IDE" button to WorktreeCard
- [ ] Implement `useIDEService` hook
- [ ] Add IDE status indicator (optional)
- [ ] Implement real-time status updates via WebSocket
- [ ] Test end-to-end flow in UI
- [ ] Polish UX (loading states, error messages)

### Phase 4: Lifecycle Management (Week 3)

- [ ] Implement health checks for IDE instances
- [ ] Implement auto-stop after inactivity
- [ ] Implement cleanup on daemon shutdown
- [ ] Add resource limits (max concurrent IDEs per user)
- [ ] Add auth validation in proxy router

### Phase 5: Production Readiness (Week 4)

- [ ] Add installation check on daemon startup
- [ ] Implement pre-installed extensions
- [ ] Add configuration options (config.yaml)
- [ ] Write integration tests
- [ ] Write E2E tests
- [ ] Update documentation
- [ ] Test on staging environment

---

## Decisions Made

1. **code-server over OpenVSCode Server**: Larger community, better features, more battle-tested
2. **Link out vs iframe**: Link out to new tab for full screen, avoid security/auth complexity
3. **One instance per worktree**: Matches existing Environment pattern, simple lifecycle
4. **Proxy via Express**: Dynamic routing with http-proxy-middleware, no nginx needed
5. **Auth disabled on code-server**: Agor daemon handles auth, simpler architecture
6. **Port allocation**: Deterministic hash from worktree ID, idempotent
7. **No auto-start**: Manual opt-in via "Open IDE" button (can add auto-start later)
8. **Cleanup strategy**: Manual stop + auto-cleanup on worktree delete

---

## Open Questions

### 1. Multi-User Collaboration in IDE?

**Question:** Should multiple users be able to open the same IDE instance (Live Share)?

**Options:**

- A) One IDE per worktree (current plan) - users take turns
- B) VS Code Live Share extension - real-time collaboration
- C) Multiple IDEs per worktree (one per user) - isolated but sync'd

**Recommendation:** Start with A (one per worktree). Add Live Share extension in Phase 2 if requested.

### 2. Persistent vs Ephemeral Settings?

**Question:** Should VS Code settings persist across IDE restarts?

**Current:** `--user-data-dir ~/.agor/ide-data/{worktreeId}` persists settings per worktree

**Trade-offs:**

- Persistent: Better UX (remember theme, extensions)
- Ephemeral: Cleaner, no state accumulation

**Recommendation:** Keep persistent. Users expect settings to persist.

### 3. Extension Marketplace Access?

**Question:** Should users be able to install extensions from VS Code marketplace?

**Options:**

- A) Allow full marketplace access (code-server default)
- B) Curated extension list only
- C) No extensions (minimal VS Code)

**Security concern:** Malicious extensions could access worktree files

**Recommendation:** Start with A (full access). Add warnings/permissions in Phase 2.

### 4. Resource Limits?

**Question:** How many concurrent IDEs should one user run?

**Considerations:**

- Each IDE uses ~200-500MB RAM
- Each IDE uses CPU for file watching, LSP
- 10 concurrent IDEs = ~5GB RAM

**Recommendation:** Start with limit of 5 concurrent IDEs per user. Configurable in config.yaml.

### 5. Docker vs Native?

**Question:** Should IDE instances run in Docker containers?

**Pros:**

- Better isolation
- Easier to limit resources (CPU, memory)
- Consistent environment

**Cons:**

- More complex setup
- Higher overhead

**Recommendation:** Start with native processes (simpler). Add Docker option in Phase 3.

---

## Success Metrics

**How we'll know this feature is valuable:**

1. **Adoption:** % of worktrees with IDE opened (target: >40%)
2. **Retention:** Users return to same IDE instance (target: >60%)
3. **Stability:** Uptime of IDE instances (target: >95%)
4. **Performance:** Time to spawn IDE (target: <5 seconds)
5. **Feedback:** Qualitative user feedback on IDE experience

---

## Final Comparison: Remote SSH vs code-server

| Factor                  | Remote SSH                       | code-server                                                    |
| ----------------------- | -------------------------------- | -------------------------------------------------------------- |
| **Setup complexity**    | Minimal (show SSH info)          | High (spawn, proxy, lifecycle)                                 |
| **User settings**       | ✅ Local IDE with all settings   | ❌ Need to reconfigure                                         |
| **Git credentials**     | ✅ Local keychain works          | ❌ Need to re-enter (can seed GITHUB_TOKEN from Agor env vars) |
| **Performance**         | ✅ Native app                    | ⚠️ Browser (slower)                                            |
| **Works with any IDE**  | ✅ VS Code, JetBrains, Vim, etc. | ❌ Only VS Code                                                |
| **Infrastructure**      | ✅ Zero (just SSH)               | ❌ Process management, proxying, state                         |
| **iPad/tablet support** | ❌ No native IDE                 | ✅ Browser-based                                               |
| **Zero-install**        | ❌ Need IDE installed            | ✅ Just browser                                                |
| **Maintenance burden**  | ✅ None                          | ❌ Process lifecycle, health checks, cleanup                   |
| **Code to maintain**    | ~100 lines                       | ~2000+ lines                                                   |

## Recommendation: Hybrid Approach

**Phase 1: Remote SSH (Core Feature)**

- Implement SSH connection info display
- Generate SSH config snippets
- Document setup for VS Code, JetBrains, etc.
- **Effort: 1-2 days**

**Phase 2 (Optional): code-server for Advanced Users**

- Only implement if users specifically request browser-based IDE
- Target users: iPad/Chromebook, public computers
- Feature flag: `agor config set ide.code_server.enabled true`
- **Effort: 2-3 weeks**

### Addressing State/Credentials Issues (If Implementing code-server)

**User mentioned:** Agor already has user env vars - can seed GITHUB_TOKEN

```typescript
// When spawning code-server, inject user's configured tokens
const userEnvVars = await getUserEnvVars(userId);

spawn('code-server', [...args], {
  env: {
    ...process.env,
    // Seed from Agor's user env settings
    GITHUB_TOKEN: userEnvVars.GITHUB_TOKEN,
    NPM_TOKEN: userEnvVars.NPM_TOKEN,
    // ... other tokens
  },
});
```

**This helps but doesn't solve:**

- VS Code settings still won't sync from local IDE
- Extensions still need to be configured
- Still browser-based performance limitations

**Bottom line:** Even with credential seeding, Remote SSH is still better for 90% of users.

---

## Updated Implementation Status

### ✅ Phase 0: Research & Design (COMPLETE)

- [x] Research Remote SSH vs code-server
- [x] Evaluate state/credential management
- [x] Compare complexity and user experience
- [x] Write design document
- [x] **Decision: Recommend Remote SSH as primary approach**

### 📝 Phase 1: Remote SSH (RECOMMENDED - ~1-2 days)

- [ ] Add SSH connection info to Worktree API
- [ ] Create UI component showing SSH command + config
- [ ] Add copy-to-clipboard functionality
- [ ] Write documentation for VS Code Remote SSH setup
- [ ] Write documentation for JetBrains Gateway setup
- [ ] (Optional) Add VS Code deep link support

### 🔮 Phase 2: code-server (OPTIONAL - if requested)

- [ ] Feature flag for enabling code-server
- [ ] Implement process spawning (as documented above)
- [ ] Implement proxy middleware
- [ ] Add lifecycle management
- [ ] User env var seeding for credentials
- [ ] Write comprehensive docs explaining limitations

---

## Related Work

- [[worktrees]] - Worktree data model and board architecture
- [[environment-logs-and-mcp]] - Environment process management (similar pattern)
- [[architecture]] - Overall system architecture
- [[websockets]] - Real-time communication for status updates
- [[auth]] - Authentication and authorization
- [[user-env-vars]] - User environment variables for seeding credentials

**External References:**

**Remote SSH:**

- [VS Code Remote Development using SSH](https://code.visualstudio.com/docs/remote/ssh)
- [VS Code Remote SSH Tutorial](https://code.visualstudio.com/docs/remote/ssh-tutorial)
- [JetBrains Gateway](https://www.jetbrains.com/remote-development/gateway/)

**code-server (optional):**

- [code-server GitHub](https://github.com/coder/code-server)
- [code-server Documentation](https://coder.com/docs/code-server)
- [http-proxy-middleware](https://github.com/chimurai/http-proxy-middleware)
- [VS Code Web Documentation](https://code.visualstudio.com/docs/remote/vscode-server)

---

## Implementation Status

### 🔍 Phase 0: Research & Design (COMPLETE)

- [x] Research code-server vs OpenVSCode Server
- [x] Investigate multi-user architecture patterns
- [x] Analyze proxy and WebSocket requirements
- [x] Document integration approach
- [x] Write design document

### 📝 Phase 1: Core Infrastructure (TODO)

- [ ] Create database migration for `ide_instances` table
- [ ] Implement `IDEManager` class
- [ ] Implement port allocation logic
- [ ] Implement IDE instance repository
- [ ] Write unit tests for port allocation
- [ ] Test process spawning locally

### 🚧 Phase 2: Backend Integration (TODO)

- [ ] Install http-proxy-middleware
- [ ] Implement IDE proxy setup
- [ ] Create IDE FeathersJS service
- [ ] Handle WebSocket upgrades
- [ ] Test proxy routing end-to-end
- [ ] Write integration tests

### 🎨 Phase 3: Frontend (TODO)

- [ ] Add "Open IDE" button to WorktreeCard
- [ ] Implement useIDEService hook
- [ ] Add IDE status indicator
- [ ] Implement real-time status updates
- [ ] Test UI flow
- [ ] Polish error handling

### 🔒 Phase 4: Production (TODO)

- [ ] Implement health checks
- [ ] Implement auto-stop after inactivity
- [ ] Add resource limits
- [ ] Add auth validation
- [ ] Write E2E tests
- [ ] Deploy to staging

---

**Next Steps:**

1. ✅ Review design doc with team - **Decision: Remote SSH preferred**
2. Implement Remote SSH connection info display (~1-2 days)
3. Document setup for popular IDEs (VS Code, JetBrains)
4. Gather user feedback - do they want browser-based IDE?
5. (Optional) Implement code-server only if users request it

**Recommended Priority:**

- **High:** Remote SSH implementation (simple, effective)
- **Low:** code-server (complex, limited benefit for most users)
- **Wait for user feedback** before investing in code-server infrastructure
