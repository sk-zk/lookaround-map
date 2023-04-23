module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: "eslint:recommended",
  overrides: [],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  rules: {
    quotes: [
      2,
      "double",
      {
        avoidEscape: true,
        allowTemplateLiterals: true,
      },
    ],
    "no-unused-vars": "off"
  },
};
