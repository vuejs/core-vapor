# Vue Vapor

This repository is a fork of [vuejs/core](https://github.com/vuejs/core) and is used for research and development of no virtual dom mode.

## TODO

PR are welcome! Please create a issue before you start to work on it.

See the To-do list below or `// TODO` comments in code (`compiler-vapor` and `runtime-vapor` packages).

- [x] counter
  - [x] simple bindings
  - [x] simple events
- [ ] TODO-MVC
- [ ] directives
  - [x] `v-once`
  - [x] `v-html`
  - [x] `v-text`
  - [x] `v-pre`
  - [x] `v-cloak`
  - [ ] `v-on` / `v-bind`
    - [x] simple expression
    - [ ] compound expression
    - [ ] modifiers
  - [ ] `v-memo`
  - [ ] `v-model`
  - [ ] `v-if` / `v-else` / `v-else-if`
  - [ ] `v-for`
  - [ ] `v-show`
    - [ ] runtime directive
    - [ ] compiler
- [ ] Remove DOM API in codegen
- [ ] Fragment
- [ ] Built-in Components
  - [ ] Transition
  - [ ] TransitionGroup
  - [ ] KeepAlive
  - [ ] Teleport
  - [ ] Suspense
- [ ] Component
  - [ ] runtime
  - [ ] compiler
- ...
- [ ] SSR
- [ ] Performance & Optimization
  - [ ] remove unnecessary close tag `</div>`

## Sponsors

Vue.js is an MIT-licensed open source project with its ongoing development made possible entirely by the support of these awesome [backers](https://github.com/vuejs/core/blob/main/BACKERS.md). If you'd like to join them, please consider [ sponsoring Vue's development](https://vuejs.org/sponsor/).

<p align="center">
  <h3 align="center">Special Sponsor</h3>
</p>

<p align="center">
  <a target="_blank" href="https://github.com/appwrite/appwrite">
  <img alt="special sponsor appwrite" src="https://sponsors.vuejs.org/images/appwrite.svg" width="300">
  </a>
</p>

<p align="center">
  <a target="_blank" href="https://vuejs.org/sponsor/#current-sponsors">
    <img alt="sponsors" src="https://sponsors.vuejs.org/sponsors.svg?v3">
  </a>
</p>

## License

[MIT](https://opensource.org/licenses/MIT)

Copyright (c) 2013-present, Yuxi (Evan) You
