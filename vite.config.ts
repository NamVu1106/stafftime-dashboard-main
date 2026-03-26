/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type LanAddress = {
  address: string;
  label?: string;
};

function uniqueLanAddresses(addresses: LanAddress[]) {
  const seen = new Set<string>();
  return addresses.filter((item) => {
    if (!item.address || seen.has(item.address)) {
      return false;
    }
    seen.add(item.address);
    return true;
  });
}

function getWindowsPreferredLanAddresses(): LanAddress[] {
  if (process.platform !== 'win32') {
    return [];
  }

  try {
    const script = [
      '$items = Get-NetIPAddress -AddressFamily IPv4 |',
      "  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.AddressState -eq 'Preferred' } |",
      '  Select-Object IPAddress, InterfaceAlias',
      "if ($null -eq $items) { '[]' } else { $items | ConvertTo-Json -Compress }",
    ].join(' ');

    const raw = execFileSync('powershell.exe', ['-NoProfile', '-Command', script], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as
      | { IPAddress: string; InterfaceAlias?: string }
      | Array<{ IPAddress: string; InterfaceAlias?: string }>;

    const entries = Array.isArray(parsed) ? parsed : [parsed];

    return uniqueLanAddresses(
      entries.map((entry) => ({
        address: entry.IPAddress,
        label: entry.InterfaceAlias,
      }))
    );
  } catch {
    return [];
  }
}

function getFallbackLanAddresses(): LanAddress[] {
  const entries: LanAddress[] = [];

  for (const [label, addresses] of Object.entries(os.networkInterfaces())) {
    for (const item of addresses ?? []) {
      const family = typeof item.family === 'string' ? item.family : item.family === 4 ? 'IPv4' : 'IPv6';

      if (
        family !== 'IPv4' ||
        item.internal ||
        item.address.startsWith('127.') ||
        item.address.startsWith('169.254.')
      ) {
        continue;
      }

      entries.push({
        address: item.address,
        label,
      });
    }
  }

  return uniqueLanAddresses(entries);
}

function getLanAddresses() {
  const windowsAddresses = getWindowsPreferredLanAddresses();
  return windowsAddresses.length > 0 ? windowsAddresses : getFallbackLanAddresses();
}

function printLanUrls(port: number, modeLabel: string) {
  const lanAddresses = getLanAddresses();

  if (lanAddresses.length === 0) {
    return;
  }

  console.log(`\n[LAN] ${modeLabel}:`);
  for (const item of lanAddresses) {
    const label = item.label ? ` (${item.label})` : '';
    console.log(`[LAN] Frontend${label}: http://${item.address}:${port}`);
  }
  console.log('[LAN] Dung URL Frontend o tren khi mo tu may khac.\n');
}

function lanHintPlugin() {
  return {
    name: 'preferred-lan-hint',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        printLanUrls(Number(server.config.server.port ?? 5173), 'Vite dev URL dang active');
      });
    },
    configurePreviewServer(server) {
      server.httpServer?.once('listening', () => {
        printLanUrls(Number(server.config.preview.port ?? 5173), 'Vite preview URL dang active');
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), lanHintPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
});

