[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

This repository provides a foundation for integrating VSCode with Stream Deck, enabling dynamic button display and execution from VSCode, along with the NPM Scripts Provider built on this foundation.

<p align="center">
  <img src="packages/streamdeck-integration/imgs/top.jpg" width="400" />
</p>

| Name | Type | Description |
|---------|------|-------------|
| [Stream Deck Integration](./packages/streamdeck-integration) | VSCode Extension + npm | Stream Deck integration host. Supports multiple VSCode instances, multiple Providers, and multiple Stream Deck devices |
| [VSCode Runner](./packages/vscode-runner) | Stream Deck Plugin | Stream Deck plugin. Communicates with VSCode for button display and execution |
| [NPM Scripts Deck](./packages/npm-scripts-deck) | VSCode Extension | Provider that displays and executes npm scripts from package.json as Stream Deck buttons |

See [Custom Provider Guide](./packages/streamdeck-integration/custom-provider-guide.md) for implementing original Provider.