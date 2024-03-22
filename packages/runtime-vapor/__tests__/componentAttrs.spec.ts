import {
  createComponent,
  getCurrentInstance,
  nextTick,
  ref,
  setText,
  template,
  watchEffect,
} from '../src'
import { setCurrentInstance } from '../src/component'
import { makeRender } from './_utils'

const define = makeRender<any>()

describe('attribute fallthrough', () => {
  it('should allow attrs to fallthrough', async () => {
    const t0 = template('<div>')
    const { component: Child } = define({
      props: ['foo'],
      render() {
        const instance = getCurrentInstance()!
        const n0 = t0()
        watchEffect(() => setText(n0, instance.props.foo))
        return n0
      },
    })

    const foo = ref(1)
    const id = ref('a')
    const { instance, host } = define({
      setup() {
        return { foo, id }
      },
      render(_ctx: Record<string, any>) {
        return createComponent(
          Child,
          [
            {
              foo: () => _ctx.foo,
              id: () => _ctx.id,
            },
          ],
          true,
        )
      },
    }).render()
    const reset = setCurrentInstance(instance)
    expect(host.innerHTML).toBe('<div id="a">1</div>')

    foo.value++
    await nextTick()
    expect(host.innerHTML).toBe('<div id="a">2</div>')

    id.value = 'b'
    await nextTick()
    expect(host.innerHTML).toBe('<div id="b">2</div>')
    reset()
  })

  it('should not fallthrough if explicitly pass inheritAttrs: false', async () => {
    const t0 = template('<div>')
    const { component: Child } = define({
      props: ['foo'],
      inheritAttrs: false,
      render() {
        const instance = getCurrentInstance()!
        const n0 = t0()
        watchEffect(() => setText(n0, instance.props.foo))
        return n0
      },
    })

    const foo = ref(1)
    const id = ref('a')
    const { instance, host } = define({
      setup() {
        return { foo, id }
      },
      render(_ctx: Record<string, any>) {
        return createComponent(
          Child,
          [
            {
              foo: () => _ctx.foo,
              id: () => _ctx.id,
            },
          ],
          true,
        )
      },
    }).render()
    const reset = setCurrentInstance(instance)
    expect(host.innerHTML).toBe('<div>1</div>')

    foo.value++
    await nextTick()
    expect(host.innerHTML).toBe('<div>2</div>')

    id.value = 'b'
    await nextTick()
    expect(host.innerHTML).toBe('<div>2</div>')
    reset()
  })

  it('should pass through attrs in nested single root components', async () => {
    const t0 = template('<div>')
    const { component: Grandson } = define({
      props: ['custom-attr'],
      render() {
        const instance = getCurrentInstance()!
        const n0 = t0()
        watchEffect(() => setText(n0, instance.attrs.foo))
        return n0
      },
    })

    const { component: Child } = define({
      render() {
        const n0 = createComponent(
          Grandson,
          [
            {
              'custom-attr': () => 'custom-attr',
            },
          ],
          true,
        )
        return n0
      },
    })

    const foo = ref(1)
    const id = ref('a')
    const { instance, host } = define({
      setup() {
        return { foo, id }
      },
      render(_ctx: Record<string, any>) {
        return createComponent(
          Child,
          [
            {
              foo: () => _ctx.foo,
              id: () => _ctx.id,
            },
          ],
          true,
        )
      },
    }).render()
    const reset = setCurrentInstance(instance)
    expect(host.innerHTML).toBe('<div foo="1" id="a">1</div>')

    foo.value++
    await nextTick()
    expect(host.innerHTML).toBe('<div foo="2" id="a">2</div>')

    id.value = 'b'
    await nextTick()
    expect(host.innerHTML).toBe('<div foo="2" id="b">2</div>')
    reset()
  })
})
