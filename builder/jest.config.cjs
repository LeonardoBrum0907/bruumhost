module.exports = {
   preset: 'ts-jest',
   testEnvironment: 'node',
   roots: ['<rootDir>/src'],
   testMatch: ['**/__tests__/**/*.test.ts'],
   moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/src/$1'
   },
   globals: {
      'ts-jest': {
         tsconfig: '<rootDir>/tsconfig.jest.json'
      }
   },
   clearMocks: true
}