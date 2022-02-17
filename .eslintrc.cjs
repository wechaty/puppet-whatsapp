
const rules = {
  "@typescript-eslint/no-misused-promises": [
    "error",
    {
      "checksVoidReturn": false
    }
  ]
}

module.exports = {
  globals: {
    NodeJS: true
  },
  extends: '@chatie',
  rules,
}
