import { BindingTypes, NodeTypes } from '@vue/compiler-dom'
import { IRNodeTypes } from '../../src'
import { getBaseTransformPreset } from '../../src/compile'
import { makeCompile } from './_utils'

const [nodeTransforms, directiveTransforms] = getBaseTransformPreset(true)
const compileWithOnce = makeCompile({
  nodeTransforms,
  directiveTransforms,
})

describe('compiler: v-once', () => {
  test('basic', () => {
    const { ir, code, helpers } = compileWithOnce(
      `<div v-once>
        {{ msg }}
        <span :class="clz" />
      </div>`,
      {
        bindingMetadata: {
          msg: BindingTypes.SETUP_REF,
          clz: BindingTypes.SETUP_REF,
        },
      },
    )

    expect(code).toMatchSnapshot()
    expect(helpers).lengthOf(0)
    expect(ir.effect).lengthOf(0)
    expect(ir.operation).toMatchObject([
      {
        id: 1,
        type: IRNodeTypes.CREATE_TEXT_NODE,
      },
      {
        element: 1,
        type: IRNodeTypes.SET_TEXT,
        value: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'msg',
          isStatic: false,
        },
      },
      {
        element: 2,
        key: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'class',
          isStatic: true,
        },
        type: IRNodeTypes.SET_PROP,
        value: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'clz',
          isStatic: false,
        },
      },
      {
        type: IRNodeTypes.PREPEND_NODE,
        elements: [1],
        parent: 3,
      },
    ])
  })

  test('as root node', () => {
    const { ir, code, helpers } = compileWithOnce(`<div :id="foo" v-once />`)

    expect(code).toMatchSnapshot()
    expect(helpers).lengthOf(0)
    expect(ir.effect).lengthOf(0)
    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_PROP,
        element: 1,
        key: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'id',
          isStatic: true,
        },
        value: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'foo',
          isStatic: false,
        },
      },
    ])
    expect(code).not.contains('effect')
  })

  test('on nested plain element', () => {
    const { ir, code, helpers } = compileWithOnce(
      `<div><div :id="foo" v-once /></div>`,
    )

    expect(code).toMatchSnapshot()
    expect(helpers).lengthOf(0)
    expect(ir.effect).lengthOf(0)
    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_PROP,
        element: 1,
        runtimeCamelize: false,
        key: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'id',
          isStatic: true,
        },
        value: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'foo',
          isStatic: false,
        },
      },
    ])
  })

  test.todo('on component')
  test.todo('on slot outlet')

  test('inside v-once', () => {
    const { ir, code, helpers } = compileWithOnce(
      `<div v-once><div v-once/></div>`,
    )

    expect(code).toMatchSnapshot()
    expect(helpers).lengthOf(0)
    expect(ir.effect).lengthOf(0)
    expect(ir.operation).lengthOf(0)
  })

  test.todo('with hoistStatic: true')
  test.todo('with v-if/else')
  test.todo('with v-for')
})
