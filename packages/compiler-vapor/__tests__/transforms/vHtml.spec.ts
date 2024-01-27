import { BindingTypes, DOMErrorCodes, NodeTypes } from '@vue/compiler-dom'
import { IRNodeTypes, transformElement, transformVHtml } from '../../src'
import { makeCompile } from './_utils'

const compileWithVHtml = makeCompile({
  nodeTransforms: [transformElement],
  directiveTransforms: {
    html: transformVHtml,
  },
})

describe('v-html', () => {
  test('should convert v-html to innerHTML', () => {
    const { code, ir, helpers, vaporHelpers } = compileWithVHtml(
      `<div v-html="code"></div>`,
      {
        bindingMetadata: {
          code: BindingTypes.SETUP_REF,
        },
      },
    )

    expect(vaporHelpers).contains('setHtml')
    expect(helpers.size).toBe(0)

    expect(ir.operation).toEqual([])
    expect(ir.effect).toMatchObject([
      {
        expressions: [
          {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: 'code',
            isStatic: false,
          },
        ],
        operations: [
          {
            type: IRNodeTypes.SET_HTML,
            element: 1,
            value: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: 'code',
              isStatic: false,
            },
          },
        ],
      },
    ])

    expect(code).matchSnapshot()
  })

  test('should raise error and ignore children when v-html is present', () => {
    const onError = vi.fn()
    const { code, ir, helpers, vaporHelpers } = compileWithVHtml(
      `<div v-html="test">hello</div>`,
      {
        onError,
      },
    )

    expect(vaporHelpers).contains('setHtml')
    expect(helpers.size).toBe(0)

    // children should have been removed
    expect(ir.template).toMatchObject([{ template: '<div></div>' }])

    expect(ir.operation).toEqual([])
    expect(ir.effect).toMatchObject([
      {
        expressions: [
          {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: 'test',
            isStatic: false,
          },
        ],
        operations: [
          {
            type: IRNodeTypes.SET_HTML,
            element: 1,
            value: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: 'test',
              isStatic: false,
            },
          },
        ],
      },
    ])

    expect(onError.mock.calls).toMatchObject([
      [{ code: DOMErrorCodes.X_V_HTML_WITH_CHILDREN }],
    ])

    expect(code).matchSnapshot()
    // children should have been removed
    expect(code).contains('template("<div></div>")')
  })

  test('should raise error if has no expression', () => {
    const onError = vi.fn()
    const { code } = compileWithVHtml(`<div v-html></div>`, {
      onError,
    })
    expect(code).matchSnapshot()
    expect(onError.mock.calls).toMatchObject([
      [{ code: DOMErrorCodes.X_V_HTML_NO_EXPRESSION }],
    ])
  })
})
