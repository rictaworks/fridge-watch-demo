import type { NextConfig } from 'next';
import * as path from 'path';

/**
 * バックエンド(デモ版 Rails/Express API)の場所。既定は http://localhost:3000。
 * `/api/*` を同一オリジンとして委譲(rewrites)することで CORS 回避・セッション Cookie を成立させる。
 * 環境変数 API_BASE_URL(サーバ側)で上書き可能。
 */
const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';

const nextConfig: NextConfig = {
  // 複数 lockfile 環境でのワークスペースルート誤検出を防ぐ。
  turbopack: {
    root: path.join(__dirname),
  },
  // next-intl / use-intl(+ 依存の @formatjs)は ESM 配布。
  // Jest(next/jest)がこれらを変換対象に含められるよう明示する(build/SSR には影響しない)。
  transpilePackages: [
    'next-intl',
    'use-intl',
    'intl-messageformat',
    '@formatjs/fast-memoize',
    '@formatjs/icu-messageformat-parser',
    '@formatjs/icu-skeleton-parser',
    '@formatjs/intl-localematcher',
  ],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_BASE_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
