import type { Config } from 'jest';
import nextJest from 'next/jest.js';

/** next/jest で SWC 変換・パスエイリアス・env を取り込む。 */
const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['<rootDir>/__tests__/**/*.test.{ts,tsx}'],
};

export default createJestConfig(config);
