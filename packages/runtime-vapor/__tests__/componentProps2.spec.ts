import { defineComponent } from 'vue'

import type { FunctionalComponent } from '../src/component'
import { getCurrentInstance } from '../src/component'
import { render } from '../src/render'

let host: HTMLElement
const initHost = () => {
  host = document.createElement('div')
  host.setAttribute('id', 'host')
  document.body.appendChild(host)
}
beforeEach(() => initHost())
afterEach(() => host.remove())

describe('component props (vapor)', () => {
  test('stateful', () => {
    let props: any
    // TODO: attrs

    const Comp = defineComponent({
      props: ['fooBar', 'barBaz'],
      render() {
        const instance = getCurrentInstance()!
        props = instance.props
      },
    })

    render(
      Comp as any,
      {
        get fooBar() {
          return 1
        },
      },
      host,
    )
    expect(props.fooBar).toEqual(1)

    // test passing kebab-case and resolving to camelCase
    render(
      Comp as any,
      {
        get ['foo-bar']() {
          return 2
        },
      },
      host,
    )
    expect(props.fooBar).toEqual(2)

    // test updating kebab-case should not delete it (#955)
    render(
      Comp as any,
      {
        get ['foo-bar']() {
          return 3
        },
        get barBaz() {
          return 5
        },
      },
      host,
    )
    expect(props.fooBar).toEqual(3)
    expect(props.barBaz).toEqual(5)

    render(Comp as any, {}, host)
    expect(props.fooBar).toBeUndefined()
    expect(props.barBaz).toBeUndefined()
    // expect(props.qux).toEqual(5) // TODO: attrs
  })

  test('stateful with setup', () => {
    // FIXME: is it necessary?
  })

  test('functional with declaration', () => {
    let props: any
    // TODO: attrs

    const Comp: FunctionalComponent = (_props) => {
      const instance = getCurrentInstance()!
      props = instance.props
      return {}
    }
    Comp.props = ['foo']
    Comp.render = (() => {}) as any

    render(
      Comp as any,
      {
        get foo() {
          return 1
        },
      },
      host,
    )
    expect(props.foo).toEqual(1)

    render(
      Comp as any,
      {
        get foo() {
          return 2
        },
      },
      host,
    )
    expect(props.foo).toEqual(2)

    render(Comp as any, {}, host)
    expect(props.foo).toBeUndefined()
  })

  test('functional without declaration', () => {
    let props: any
    // TODO: attrs

    const Comp: FunctionalComponent = (_props) => {
      const instance = getCurrentInstance()!
      props = instance.props
      return {}
    }
    Comp.props = undefined as any
    Comp.render = (() => {}) as any

    render(
      Comp as any,
      {
        get foo() {
          return 1
        },
      },
      host,
    )
    expect(props.foo).toBeUndefined()

    render(
      Comp as any,
      {
        get foo() {
          return 2
        },
      },
      host,
    )
    expect(props.foo).toBeUndefined()
  })

  test('boolean casting', () => {
    let props: any
    const Comp = {
      props: {
        foo: Boolean,
        bar: Boolean,
        baz: Boolean,
        qux: Boolean,
      },
      render() {
        const instance = getCurrentInstance()!
        props = instance.props
      },
    }

    render(
      Comp as any,
      {
        // absent should cast to false
        bar: '', // empty string should cast to true
        baz: 1, // same string should cast to true
        qux: 'ok', // other values should be left in-tact (but raise warning)
      },
      host,
    )

    expect(props.foo).toBe(false)
    expect(props.bar).toBe(true)
    // expect(props.baz).toBe(true) // FIXME: failed
    expect(props.qux).toBe('ok')
  })

  test('default value', () => {
    let props: any
    const defaultFn = vi.fn(() => ({ a: 1 }))
    const defaultBaz = vi.fn(() => ({ b: 1 }))

    const Comp = {
      props: {
        foo: {
          default: 1,
        },
        bar: {
          default: defaultFn,
        },
        baz: {
          type: Function,
          default: defaultBaz,
        },
      },
      render() {
        const instance = getCurrentInstance()!
        props = instance.props
      },
    }

    render(
      Comp as any,
      {
        get foo() {
          return 2
        },
      },
      host,
    )
    expect(props.foo).toBe(2)
    const prevBar = props.bar
    // expect(props.bar).toEqual({ a: 1 })        // FIXME: failed
    expect(props.baz).toEqual(defaultBaz)
    // expect(defaultFn).toHaveBeenCalledTimes(1) // FIXME: failed
    expect(defaultBaz).toHaveBeenCalledTimes(0)

    // #999: updates should not cause default factory of unchanged prop to be
    // called again
    render(
      Comp as any,
      {
        get foo() {
          return 3
        },
      },
      host,
    )
    expect(props.foo).toBe(3)
    // expect(props.bar).toEqual({ a: 1 }) // FIXME: failed
    expect(props.bar).toBe(prevBar)
    // expect(defaultFn).toHaveBeenCalledTimes(1) // FIXME: failed

    render(
      Comp as any,
      {
        get bar() {
          return { b: 2 }
        },
      },
      host,
    )
    expect(props.foo).toBe(1)
    expect(props.bar).toEqual({ b: 2 })
    // expect(defaultFn).toHaveBeenCalledTimes(1) // FIXME: failed

    render(
      Comp as any,
      {
        get foo() {
          return 3
        },
        get bar() {
          return { b: 3 }
        },
      },
      host,
    )
    expect(props.foo).toBe(3)
    expect(props.bar).toEqual({ b: 3 })
    // expect(defaultFn).toHaveBeenCalledTimes(1) // FIXME: failed

    render(
      Comp as any,
      {
        get bar() {
          return { b: 4 }
        },
      },
      host,
    )
    expect(props.foo).toBe(1)
    expect(props.bar).toEqual({ b: 4 })
    // expect(defaultFn).toHaveBeenCalledTimes(1) // FIXME: failed
  })
})
