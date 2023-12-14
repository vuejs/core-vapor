import {
  template,
  children,
  effect,
  setText,
  render,
  getCurrentInstance,
  ref,
  unmountComponent,
} from '../src'
import type { ComponentInternalInstance } from '../src'
import { afterEach, beforeEach, describe, expect } from 'vitest'
import { defineComponent, nextTick } from '@vue/runtime-core'

let host: HTMLElement

const initHost = () => {
  host = document.createElement('div')
  host.setAttribute('id', 'host')
  document.body.appendChild(host)
}
beforeEach(() => {
  initHost()
})
afterEach(() => {
  host.remove()
})
describe('component', () => {
  test('unmountComponent', async () => {
    const Comp = defineComponent({
      setup() {
        const count = ref(0)
        const t0 = template('<div></div>')
        const n0 = t0()
        const {
          0: [n1],
        } = children(n0)
        effect(() => {
          setText(n1, void 0, count.value)
        })
        return n0
      },
    })
    const instance = render(Comp as any, {}, '#host')
    await nextTick()
    expect(host.innerHTML).toBe('<div>0</div>')
    unmountComponent(instance)
    expect(host.innerHTML).toBe('')
  })
})
