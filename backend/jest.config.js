module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFilesAfterEnv: ['<rootDir>/tests/setupTestEnv.js', '<rootDir>/tests/setupTestDB.js'],
  testTimeout: 30000
};
