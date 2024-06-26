import {
  type Directive,
  createComponent,
  createIf,
  nextTick,
  ref,
  renderEffect,
  setText,
  template,
  watchEffect,
  withDirectives,
} from '../src'
import { describe, expect } from 'vitest'
import { makeRender } from './_utils'

const define = makeRender()

describe('component', () => {
  test('unmountComponent', async () => {
    const { host, app } = define(() => {
      const count = ref(0)
      const t0 = template('<div></div>')
      const n0 = t0()
      watchEffect(() => {
        setText(n0, count.value)
      })
      return n0
    }).render()
    expect(host.innerHTML).toBe('<div>0</div>')
    app.unmount()
    expect(host.innerHTML).toBe('')
  })

  it('directive lifecycle hooks call order', async () => {
    const rootCounter = ref(0)
    const propsCounter = ref(0)
    const toggle = ref(true)
    const calls: string[] = []

    const vDirective = (name: string): Directive => ({
      created: () => calls.push(`${name} created`),
      beforeMount: () => calls.push(`${name} beforeMount`),
      mounted: () => calls.push(`${name} mounted`),
      beforeUpdate: () => calls.push(`${name} beforeUpdate`),
      updated: () => calls.push(`${name} updated`),
      beforeUnmount: () => calls.push(`${name} beforeUnmount`),
      unmounted: () => calls.push(`${name} unmounted`),
    })

    const { render } = define({
      setup() {
        return (() => {
          const n0 = withDirectives(template('<p></p>')(), [
            [vDirective('root')],
          ])
          renderEffect(() => setText(n0, rootCounter.value))
          const n1 = createIf(
            () => toggle.value,
            () => createComponent(Mid, { count: () => propsCounter.value }),
          )
          return [n0, n1]
        })()
      },
    })

    const Mid = {
      props: ['count'],
      setup(props: any) {
        return (() => {
          withDirectives(template('<p></p>')(), [[vDirective('mid')]])
          const n0 = createComponent(Child, { count: () => props.count })
          return n0
        })()
      },
    }

    const Child = {
      props: ['count'],
      setup(props: any) {
        return (() => {
          const t0 = template('<div></div>')
          const n0 = t0()
          withDirectives(n0, [[vDirective('child')]])
          renderEffect(() => setText(n0, props.count))
          return n0
        })()
      },
    }

    // mount
    render()
    expect(calls).toEqual([
      'root created',
      'mid created',
      'child created',
      'root beforeMount',
      'mid beforeMount',
      'child beforeMount',
      'root mounted',
      'mid mounted',
      'child mounted',
    ])

    calls.length = 0

    // props update
    propsCounter.value++
    await nextTick()
    // There are no calls in the root and mid,
    // but maybe such performance would be better.
    expect(calls).toEqual([
      // 'root beforeUpdate',
      // 'mid beforeUpdate',
      'child beforeUpdate',
      'child updated',
      // 'mid updated',
      // 'root updated',
    ])

    calls.length = 0

    // root update
    rootCounter.value++
    await nextTick()
    // Root update events should not be passed to children.
    expect(calls).toEqual(['root beforeUpdate', 'root updated'])

    calls.length = 0

    // unmount
    toggle.value = false
    await nextTick()
    expect(calls).toEqual([
      'root beforeUpdate',
      'mid beforeUnmount',
      'child beforeUnmount',
      'mid unmounted',
      'child unmounted',
      'root updated',
    ])

    calls.length = 0

    // mount
    toggle.value = true
    await nextTick()
    expect(calls).toEqual([
      'root beforeUpdate',
      'mid created',
      'child created',
      'mid beforeMount',
      'child beforeMount',
      'mid mounted',
      'child mounted',
      'root updated',
    ])
  })
})
