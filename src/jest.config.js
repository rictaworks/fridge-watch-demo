/**
 * Jest 設定。TDD 用ユニットテストと PR 単位テストの双方を対象にする。
 * テストは `../test/` 配下(プロジェクトルール: test/ 配下、PR 単位は test/pr<番号>/)。
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/../test', '<rootDir>/lib'],
  // test/ 配下のテストからも src/node_modules を解決できるようにする。
  modulePaths: ['<rootDir>/node_modules'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@lib/(.*)$': '<rootDir>/lib/$1',
  },
  clearMocks: true,
  verbose: true,
};
