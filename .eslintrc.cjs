
const rules = {
  "@typescript-eslint/no-misused-promises": [
    "error",
    {
      "checksVoidReturn": false
    }
  ]
}

module.exports = {
  extends: '@chatie',
  rules,
}
