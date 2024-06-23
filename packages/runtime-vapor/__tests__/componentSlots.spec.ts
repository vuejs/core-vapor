// NOTE: This test is implemented based on the case of `runtime-core/__test__/componentSlots.spec.ts`.

import {
  type ComponentInternalInstance,
  createComponent,
  createFor,
  createForSlots,
  createSlot,
  createVaporApp,
  defineComponent,
  getCurrentInstance,
  insert,
  nextTick,
  prepend,
  ref,
  renderEffect,
  setText,
  template,
  useSlots,
  withDestructure,
} from '../src'
import { makeRender } from './_utils'

const define = makeRender<any>()
function renderWithSlots(slots: any): any {
  let instance: any
  const Comp = defineComponent({
    render() {
      const t0 = template('<div></div>')
      const n0 = t0()
      instance = getCurrentInstance()
      return n0
    },
  })

  const { render } = define({
    render() {
      return createComponent(Comp, {}, slots)
    },
  })

  render()
  return instance
}

describe('component: slots', () => {
  test('initSlots: instance.slots should be set correctly', () => {
    let instance: any
    const Comp = defineComponent({
      render() {
        const t0 = template('<div></div>')
        const n0 = t0()
        instance = getCurrentInstance()
        return n0
      },
    })

    const { render } = define({
      render() {
        return createComponent(Comp, {}, { header: () => template('header')() })
      },
    })

    render()

    expect(instance.slots.header()).toMatchObject(
      document.createTextNode('header'),
    )
  })

  // NOTE: slot normalization is not supported
  test.todo(
    'initSlots: should normalize object slots (when value is null, string, array)',
    () => {},
  )
  test.todo(
    'initSlots: should normalize object slots (when value is function)',
    () => {},
  )

  // runtime-core's "initSlots: instance.slots should be set correctly (when vnode.shapeFlag is not SLOTS_CHILDREN)"
  test('initSlots: instance.slots should be set correctly', () => {
    const { slots } = renderWithSlots({
      default: () => template('<span></span>')(),
    })

    // expect(
    //   '[Vue warn]: Non-function value encountered for default slot. Prefer function slots for better performance.',
    // ).toHaveBeenWarned()

    expect(slots.default()).toMatchObject(document.createElement('span'))
  })

  test('updateSlots: instance.slots should be updated correctly', async () => {
    const flag1 = ref(true)

    let instance: any
    const Child = () => {
      instance = getCurrentInstance()
      return template('child')()
    }

    const { render } = define({
      render() {
        return createComponent(Child, {}, [
          () =>
            flag1.value
              ? { name: 'one', fn: () => template('<span></span>')() }
              : { name: 'two', fn: () => template('<div></div>')() },
        ])
      },
    })

    render()

    expect(instance.slots).toHaveProperty('one')
    expect(instance.slots).not.toHaveProperty('two')

    flag1.value = false
    await nextTick()

    expect(instance.slots).not.toHaveProperty('one')
    expect(instance.slots).toHaveProperty('two')
  })

  // NOTE: it is not supported
  // test('updateSlots: instance.slots should be updated correctly (when slotType is null)', () => {})

  // runtime-core's "updateSlots: instance.slots should be update correctly (when vnode.shapeFlag is not SLOTS_CHILDREN)"
  test('updateSlots: instance.slots should be update correctly', async () => {
    const flag1 = ref(true)

    let instance: any
    const Child = () => {
      instance = getCurrentInstance()
      return template('child')()
    }

    const { render } = define({
      setup() {
        return createComponent(Child, {}, [
          () =>
            flag1.value
              ? { name: 'header', fn: () => template('header')() }
              : { name: 'footer', fn: () => template('footer')() },
        ])
      },
    })
    render()

    expect(instance.slots).toHaveProperty('header')
    flag1.value = false
    await nextTick()

    // expect(
    //   '[Vue warn]: Non-function value encountered for default slot. Prefer function slots for better performance.',
    // ).toHaveBeenWarned()

    expect(instance.slots).toHaveProperty('footer')
  })

  test('the current instance should be kept in the slot', async () => {
    let instanceInDefaultSlot: any
    let instanceInFooSlot: any

    const Comp = defineComponent({
      render() {
        const instance = getCurrentInstance()
        instance!.slots.default!()
        instance!.slots.foo!()
        return template('<div></div>')()
      },
    })

    const { instance } = define({
      render() {
        return createComponent(Comp, {}, [
          {
            default: () => {
              instanceInDefaultSlot = getCurrentInstance()
              return template('content')()
            },
            foo: () => {
              instanceInFooSlot = getCurrentInstance()
              return template('content')()
            },
          },
        ])
      },
    }).render()

    expect(instanceInDefaultSlot).toBe(instance)
    expect(instanceInFooSlot).toBe(instance)
  })

  test('the current instance should be kept in the dynamic slots', async () => {
    let instanceInDefaultSlot: any
    let instanceInVForSlot: any
    let instanceInVIfSlot: any

    const Comp = defineComponent({
      render() {
        const instance = getCurrentInstance()
        instance!.slots.default!()
        instance!.slots.inVFor!()
        instance!.slots.inVIf!()
        return template('<div></div>')()
      },
    })

    const { instance } = define({
      render() {
        return createComponent(Comp, {}, [
          {
            default: () => {
              instanceInDefaultSlot = getCurrentInstance()
              return template('content')()
            },
          },
          () => ({
            name: 'inVFor',
            fn: () => {
              instanceInVForSlot = getCurrentInstance()
              return template('content')()
            },
          }),
          () => ({
            name: 'inVIf',
            fn: () => {
              instanceInVIfSlot = getCurrentInstance()
              return template('content')()
            },
          }),
        ])
      },
    }).render()

    expect(instanceInDefaultSlot).toBe(instance)
    expect(instanceInVForSlot).toBe(instance)
    expect(instanceInVIfSlot).toBe(instance)
  })

  test('dynamicSlots should update separately', async () => {
    const flag1 = ref(true)
    const flag2 = ref(true)
    const slotFn1 = vitest.fn()
    const slotFn2 = vitest.fn()

    let instance: any
    const Child = () => {
      instance = getCurrentInstance()
      return template('child')()
    }

    const { render } = define({
      render() {
        return createComponent(Child, {}, [
          () => {
            slotFn1()
            return flag1.value
              ? { name: 'one', fn: () => template('one')() }
              : { name: 'two', fn: () => template('two')() }
          },
          () => {
            slotFn2()
            return flag2.value
              ? { name: 'three', fn: () => template('three')() }
              : { name: 'four', fn: () => template('four')() }
          },
        ])
      },
    })

    render()

    expect(instance.slots).toHaveProperty('one')
    expect(instance.slots).toHaveProperty('three')
    expect(slotFn1).toHaveBeenCalledTimes(1)
    expect(slotFn2).toHaveBeenCalledTimes(1)

    flag1.value = false
    await nextTick()

    expect(instance.slots).toHaveProperty('two')
    expect(instance.slots).toHaveProperty('three')
    expect(slotFn1).toHaveBeenCalledTimes(2)
    expect(slotFn2).toHaveBeenCalledTimes(1)

    flag2.value = false
    await nextTick()

    expect(instance.slots).toHaveProperty('two')
    expect(instance.slots).toHaveProperty('four')
    expect(slotFn1).toHaveBeenCalledTimes(2)
    expect(slotFn2).toHaveBeenCalledTimes(2)
  })

  test('should work with createFlorSlots', async () => {
    const loop = ref([1, 2, 3])

    let instance: any
    const Child = () => {
      instance = getCurrentInstance()
      return template('child')()
    }

    const { render } = define({
      setup() {
        return createComponent(Child, {}, [
          () =>
            createForSlots(loop.value, (item, i) => ({
              name: item,
              fn: () => template(item + i)(),
            })),
        ])
      },
    })
    render()

    expect(instance.slots).toHaveProperty('1')
    expect(instance.slots).toHaveProperty('2')
    expect(instance.slots).toHaveProperty('3')
    loop.value.push(4)
    await nextTick()
    expect(instance.slots).toHaveProperty('4')
    loop.value.shift()
    await nextTick()
    expect(instance.slots).not.toHaveProperty('1')
  })

  test('should not delete new rendered slot when the old slot is removed in loop slot', async () => {
    const loop = ref([1, 'default', 3])

    let childInstance
    const t0 = template('<div></div>')
    const { component: Child } = define({
      setup() {
        childInstance = getCurrentInstance()
        const slots = useSlots()
        const keys = () => Object.keys(slots)
        return {
          keys,
          slots,
        }
      },
      render: (_ctx: any) => {
        const n0 = createFor(
          () => _ctx.keys(),
          (_ctx0: any) => {
            const n5 = t0()
            const n4 = createSlot(() => _ctx0[0])
            insert(n4, n5 as ParentNode)
            return n5
          },
        )
        return n0
      },
    })

    const t1 = template(' static default ')
    const { render } = define({
      setup() {
        return createComponent(Child, {}, [
          {
            default: () => {
              return t1()
            },
          },
          () =>
            createForSlots(loop.value, (item, i) => ({
              name: item,
              fn: () => template(item)(),
            })),
        ])
      },
    })
    const { html } = render()

    expect(childInstance!.slots).toHaveProperty('1')
    expect(childInstance!.slots).toHaveProperty('default')
    expect(childInstance!.slots).toHaveProperty('3')
    expect(html()).toBe(
      '<div>1<!--slot--></div><div>3<!--slot--></div><div>default<!--slot--></div><!--for-->',
    )
    loop.value = [1]
    await nextTick()
    expect(childInstance!.slots).toHaveProperty('1')
    expect(childInstance!.slots).toHaveProperty('default')
    expect(childInstance!.slots).not.toHaveProperty('3')
    expect(html()).toBe(
      '<div>1<!--slot--></div><div> static default <!--slot--></div><!--for-->',
    )
  })

  test('dynamicSlots should not cover high level slots', async () => {
    const dynamicFlag = ref(true)

    let instance: ComponentInternalInstance
    const { component: Child } = define({
      render() {
        instance = getCurrentInstance()!
        return [createSlot('default'), createSlot('others')]
      },
    })

    const { render, html } = define({
      render() {
        return createComponent(Child, {}, [
          () =>
            dynamicFlag.value
              ? { name: 'default', fn: () => template('dynamic default')() }
              : { name: 'others', fn: () => template('others')() },
          {
            default: () => template('default')(),
          },
        ])
      },
    })

    render()

    expect(html()).toBe('default<!--slot--><!--slot-->')

    dynamicFlag.value = false
    await nextTick()

    expect(html()).toBe('default<!--slot-->others<!--slot-->')
    expect(instance!.slots).haveOwnProperty('others')

    dynamicFlag.value = true
    await nextTick()
    expect(html()).toBe('default<!--slot--><!--slot-->')
    expect(instance!.slots).not.haveOwnProperty('others')
  })

  test.todo('should respect $stable flag', async () => {
    // TODO: $stable flag?
  })

  test.todo('should not warn when mounting another app in setup', () => {
    // TODO: warning
    const Comp = defineComponent({
      render() {
        const i = getCurrentInstance()
        return i!.slots.default!()
      },
    })
    const mountComp = () => {
      createVaporApp({
        render() {
          return createComponent(
            Comp,
            {},
            { default: () => template('msg')() },
          )!
        },
      })
    }
    const App = {
      setup() {
        mountComp()
      },
      render() {
        return null!
      },
    }
    createVaporApp(App).mount(document.createElement('div'))
    expect(
      'Slot "default" invoked outside of the render function',
    ).not.toHaveBeenWarned()
  })

  describe('createSlot', () => {
    test('slot should be render correctly', () => {
      const Comp = defineComponent(() => {
        const n0 = template('<div></div>')()
        insert(createSlot('header'), n0 as any as ParentNode)
        return n0
      })

      const { host } = define(() => {
        return createComponent(Comp, {}, { header: () => template('header')() })
      }).render()

      expect(host.innerHTML).toBe('<div>header</div>')
    })

    test('slot should be render correctly with binds', async () => {
      const Comp = defineComponent(() => {
        const n0 = template('<div></div>')()
        insert(
          createSlot('header', [{ title: () => 'header' }]),
          n0 as any as ParentNode,
        )
        return n0
      })

      const { host } = define(() => {
        return createComponent(Comp, {}, [
          {
            header: withDestructure(
              ({ title }) => [title],
              ctx => {
                const el = template('<h1></h1>')()
                renderEffect(() => {
                  setText(el, ctx[0])
                })
                return el
              },
            ),
          },
        ])
      }).render()

      expect(host.innerHTML).toBe('<div><h1>header</h1></div>')
    })

    test('dynamic slot props', async () => {
      let props: any

      const bindObj = ref<Record<string, any>>({ foo: 1, baz: 'qux' })
      const Comp = defineComponent(() =>
        createSlot('default', [() => bindObj.value]),
      )
      define(() =>
        createComponent(
          Comp,
          {},
          { default: _props => ((props = _props), []) },
        ),
      ).render()

      expect(props).toEqual({ foo: 1, baz: 'qux' })

      bindObj.value.foo = 2
      await nextTick()
      expect(props).toEqual({ foo: 2, baz: 'qux' })

      delete bindObj.value.baz
      await nextTick()
      expect(props).toEqual({ foo: 2 })
    })

    test('dynamic slot props with static slot props', async () => {
      let props: any

      const foo = ref(0)
      const bindObj = ref<Record<string, any>>({ foo: 100, baz: 'qux' })
      const Comp = defineComponent(() =>
        createSlot('default', [{ foo: () => foo.value }, () => bindObj.value]),
      )
      define(() =>
        createComponent(
          Comp,
          {},
          { default: _props => ((props = _props), []) },
        ),
      ).render()

      expect(props).toEqual({ foo: 100, baz: 'qux' })

      foo.value = 2
      await nextTick()
      expect(props).toEqual({ foo: 100, baz: 'qux' })

      delete bindObj.value.foo
      await nextTick()
      expect(props).toEqual({ foo: 2, baz: 'qux' })
    })

    test('slot class binding should be merged', async () => {
      let props: any

      const className = ref('foo')
      const classObj = ref({ bar: true })
      const Comp = defineComponent(() =>
        createSlot('default', [
          { class: () => className.value },
          () => ({ class: ['baz', 'qux'] }),
          { class: () => classObj.value },
        ]),
      )
      define(() =>
        createComponent(
          Comp,
          {},
          { default: _props => ((props = _props), []) },
        ),
      ).render()

      expect(props).toEqual({ class: 'foo baz qux bar' })

      classObj.value.bar = false
      await nextTick()
      expect(props).toEqual({ class: 'foo baz qux' })

      className.value = ''
      await nextTick()
      expect(props).toEqual({ class: 'baz qux' })
    })

    test('slot style binding should be merged', async () => {
      let props: any

      const style = ref<any>({ fontSize: '12px' })
      const Comp = defineComponent(() =>
        createSlot('default', [
          { style: () => style.value },
          () => ({ style: { width: '100px', color: 'blue' } }),
          { style: () => 'color: red' },
        ]),
      )
      define(() =>
        createComponent(
          Comp,
          {},
          { default: _props => ((props = _props), []) },
        ),
      ).render()

      expect(props).toEqual({
        style: {
          fontSize: '12px',
          width: '100px',
          color: 'red',
        },
      })

      style.value = null
      await nextTick()
      expect(props).toEqual({
        style: {
          width: '100px',
          color: 'red',
        },
      })
    })

    test('dynamic slot should be render correctly with binds', async () => {
      const Comp = defineComponent(() => {
        const n0 = template('<div></div>')()
        prepend(
          n0 as any as ParentNode,
          createSlot('header', [{ title: () => 'header' }]),
        )
        return n0
      })

      const { host } = define(() => {
        // dynamic slot
        return createComponent(Comp, {}, [
          () => ({
            name: 'header',
            fn: (props: any) => template(props.title)(),
          }),
        ])
      }).render()

      expect(host.innerHTML).toBe('<div>header<!--slot--></div>')
    })

    test('dynamic slot outlet should be render correctly with binds', async () => {
      const Comp = defineComponent(() => {
        const n0 = template('<div></div>')()
        prepend(
          n0 as any as ParentNode,
          createSlot(
            () => 'header', // dynamic slot outlet name
            [{ title: () => 'header' }],
          ),
        )
        return n0
      })

      const { host } = define(() => {
        return createComponent(
          Comp,
          {},
          { header: props => template(props.title)() },
        )
      }).render()

      expect(host.innerHTML).toBe('<div>header<!--slot--></div>')
    })

    test('fallback should be render correctly', () => {
      const Comp = defineComponent(() => {
        const n0 = template('<div></div>')()
        insert(
          createSlot('header', undefined, () => template('fallback')()),
          n0 as any as ParentNode,
        )
        return n0
      })

      const { host } = define(() => {
        return createComponent(Comp, {}, {})
      }).render()

      expect(host.innerHTML).toBe('<div>fallback</div>')
    })

    test('dynamic slot should be updated correctly', async () => {
      const flag1 = ref(true)

      const Child = defineComponent(() => {
        const temp0 = template('<p></p>')
        const el0 = temp0()
        const el1 = temp0()
        const slot1 = createSlot('one', [], () => template('one fallback')())
        const slot2 = createSlot('two', [], () => template('two fallback')())
        insert(slot1, el0 as any as ParentNode)
        insert(slot2, el1 as any as ParentNode)
        return [el0, el1]
      })

      const { host } = define(() => {
        return createComponent(Child, {}, [
          () =>
            flag1.value
              ? { name: 'one', fn: () => template('one content')() }
              : { name: 'two', fn: () => template('two content')() },
        ])
      }).render()

      expect(host.innerHTML).toBe(
        '<p>one content<!--slot--></p><p>two fallback<!--slot--></p>',
      )

      flag1.value = false
      await nextTick()

      expect(host.innerHTML).toBe(
        '<p>one fallback<!--slot--></p><p>two content<!--slot--></p>',
      )

      flag1.value = true
      await nextTick()

      expect(host.innerHTML).toBe(
        '<p>one content<!--slot--></p><p>two fallback<!--slot--></p>',
      )
    })

    test('dynamic slot outlet should be updated correctly', async () => {
      const slotOutletName = ref('one')

      const Child = defineComponent(() => {
        const temp0 = template('<p></p>')
        const el0 = temp0()
        const slot1 = createSlot(
          () => slotOutletName.value,
          undefined,
          () => template('fallback')(),
        )
        insert(slot1, el0 as any as ParentNode)
        return el0
      })

      const { host } = define(() => {
        return createComponent(
          Child,
          {},
          {
            one: () => template('one content')(),
            two: () => template('two content')(),
          },
        )
      }).render()

      expect(host.innerHTML).toBe('<p>one content<!--slot--></p>')

      slotOutletName.value = 'two'
      await nextTick()

      expect(host.innerHTML).toBe('<p>two content<!--slot--></p>')

      slotOutletName.value = 'none'
      await nextTick()

      expect(host.innerHTML).toBe('<p>fallback<!--slot--></p>')
    })
  })
})
