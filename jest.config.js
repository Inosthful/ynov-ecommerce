module.exports = {
  testMatch: ['**/tests/jest/**/*.test.js'],
  testEnvironment: 'node',
  // Seuil de couverture minimum — la CI échoue si on passe en dessous
  collectCoverage: true,
  coverageThreshold: {
    global: {
      lines: 40,
      functions: 40,
      branches: 40,
      statements: 40,
    },
  },
};
