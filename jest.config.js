module.exports = {
  // setupFiles: ['<rootDir>/src/setup.ts'],
  roots: ["<rootDir>/src"],
  preset: "ts-jest",
  transform: {
    "^.+\\.(ts|tsx)?$": "ts-jest",
    "^.+\\.(js|jsx)$": "babel-jest",
  },
};
