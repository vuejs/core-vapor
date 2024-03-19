// NOTE: This test is implemented based on the case of `runtime-core/__test__/componentSlots.spec.ts`.

import {
  createComponent,
  createSlots,
  createVaporApp,
  defineComponent,
  getCurrentInstance,
  nextTick,
  ref,
  template,
} from '../src'
import { makeRender } from './_utils'

const define = makeRender<any>()

describe('component: slots', () => {
  function renderWithSlots(slots: any): any {
    let instance: any
    const Comp = defineComponent({
      vapor: true,
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

  test('initSlots: instance.slots should be set correctly', () => {
    const { slots } = renderWithSlots({ _: 1 })
    expect(slots).toMatchObject({ _: 1 })
  })

  test.todo(
    'initSlots: should normalize object slots (when value is null, string, array)',
    () => {
      // TODO: normalize
    },
  )

  test.todo(
    'initSlots: should normalize object slots (when value is function)',
    () => {
      // TODO: normalize
    },
  )

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
        return createComponent(
          Comp,
          {},
          createSlots({
            header: () => template('header')(),
          }),
        )
      },
    })

    render()

    expect(instance.slots.header()).toMatchObject(
      document.createTextNode('header'),
    )
  })

  // TODO: test case name
  test('initSlots: instance.slots should be set correctly (when vnode.shapeFlag is not SLOTS_CHILDREN)', () => {
    const { slots } = renderWithSlots(
      createSlots({
        // TODO: normalize from array?
        default: () => template('<span></span>')(),
      }),
    )

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
        return createComponent(
          Child,
          {},
          createSlots({ _: 2 as any }, () => [
            flag1.value
              ? { name: 'one', fn: () => template('<span></span>')() }
              : { name: 'two', fn: () => template('<div></div>')() },
          ]),
        )
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

  test.todo(
    'updateSlots: instance.slots should be updated correctly',
    async () => {
      const flag1 = ref(true)

      let instance: any
      const Child = () => {
        instance = getCurrentInstance()
        return template('child')()
      }

      const oldSlots = {
        header: () => template('header')(),
        footer: undefined,
      }
      const newSlots = {
        header: undefined,
        footer: () => template('footer')(),
      }

      const { render } = define({
        setup() {
          return (() => {
            return createComponent(
              Child,
              {},
              // TODO: maybe it is not supported
              createSlots(flag1.value ? oldSlots : newSlots),
            )
          })()
        },
      })

      render()

      expect(instance.slots).toMatchObject({ _: null })

      flag1.value = false
      await nextTick()

      expect(instance.slots).toMatchObject({ _: null })
    },
  )

  // TODO: test case name
  test('updateSlots: instance.slots should be update correctly (when vnode.shapeFlag is not SLOTS_CHILDREN)', async () => {
    const flag1 = ref(true)

    let instance: any
    const Child = () => {
      instance = getCurrentInstance()
      return template('child')()
    }

    const { render } = define({
      setup() {
        return createComponent(
          Child,
          {},
          createSlots({}, () => [
            flag1.value
              ? [{ name: 'header', fn: () => template('header')() }]
              : [{ name: 'footer', fn: () => template('footer')() }],
          ]),
        )
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
            createSlots({
              default: () => template('msg')(),
            }),
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
})
