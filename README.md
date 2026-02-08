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

## Stream Deck Integration Architecture: Multi-Instance Coordination

VSCode has no built-in mechanism for multiple windows to communicate with each other. [Stream Deck Integration](./packages/streamdeck-integration) solves this with a Leader/Follower pattern over HTTP and WebSocket, so that Stream Deck always follows the active VSCode window's context — including which project is open, which file is focused, and what buttons should be displayed.

<p align="center">
  <img src="packages/streamdeck-integration/imgs/comm.png" width="700" />
</p>

- The first VSCode instance becomes the **Leader** and starts an HTTP + WebSocket server on localhost
- Later instances connect as **Followers** and communicate with the Stream Deck plugin (VSCode Runner) through the Leader
- When the active VSCode window changes, the Leader sends the corresponding buttons to Stream Deck
- When the Leader closes, Followers detect the disconnection and one is promoted to Leader (randomized delay within 500ms to avoid port conflicts)

Custom providers only need to implement single-instance logic — multi-instance coordination is handled entirely by Stream Deck Integration. A provider needs just 4 functions: `registerProvider`, `getSlots`, `run`, and `notifyChange`.

→ [Stream Deck Integration](./packages/streamdeck-integration) | [Custom Provider Guide](./packages/streamdeck-integration/custom-provider-guide.md)