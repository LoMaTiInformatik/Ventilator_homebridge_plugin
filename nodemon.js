{
  "watch": [
    "src"
  ],
  "ext": "ts",
  "ignore": [],
  "exec": "tsc && homebridge -I -D",
  "signal": "SIGTERM",
  "env": {
    "NODE_OPTIONS": "--trace-warnings"
  }
}
