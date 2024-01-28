import { makeCompile } from './_utils'
import {
  IRNodeTypes,
  type IfIRNode,
  transformElement,
  transformInterpolation,
  transformOnce,
  transformVIf,
  transformVText,
} from '../../src'
import { NodeTypes } from '@vue/compiler-core'

const compileWithVIf = makeCompile({
  nodeTransforms: [
    transformOnce,
    transformInterpolation,
    transformVIf,
    transformElement,
  ],
  directiveTransforms: {
    text: transformVText,
  },
})

describe('compiler: v-if', () => {
  test('basic v-if', () => {
    const { code, vaporHelpers, ir, helpers } = compileWithVIf(
      `<div v-if="ok">{{msg}}</div>`,
    )

    expect(vaporHelpers).contains('createIf')
    expect(helpers.size).toBe(0)

    expect(ir.template).lengthOf(2)
    expect(ir.template).toMatchObject([
      {
        template: '<div></div>',
        type: IRNodeTypes.TEMPLATE_FACTORY,
      },
      {
        type: IRNodeTypes.FRAGMENT_FACTORY,
      },
    ])
    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.IF,
        id: 1,
        condition: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'ok',
          isStatic: false,
        },
        positive: {
          type: IRNodeTypes.BLOCK_FUNCTION,
          templateIndex: 0,
        },
      },
      {
        type: IRNodeTypes.APPEND_NODE,
        elements: [1],
        parent: 0,
      },
    ])

    expect(ir.dynamic).toMatchObject({
      id: 0,
      children: { 0: { id: 1 } },
    })

    expect(ir.effect).toEqual([])
    expect((ir.operation[0] as IfIRNode).positive.effect).lengthOf(1)

    expect(code).matchSnapshot()
  })

  test('template v-if', () => {
    const { code, ir } = compileWithVIf(
      `<template v-if="ok"><div/>hello<p v-text="msg"/></template>`,
    )
    expect(code).matchSnapshot()

    expect(ir.template).lengthOf(2)
    expect(ir.template[0]).toMatchObject({
      template: '<div></div>hello<p></p>',
      type: IRNodeTypes.TEMPLATE_FACTORY,
    })

    expect(ir.effect).toEqual([])
    expect((ir.operation[0] as IfIRNode).positive.effect).toMatchObject([
      {
        operations: [
          {
            type: IRNodeTypes.SET_TEXT,
            element: 3,
            value: {
              content: 'msg',
              type: NodeTypes.SIMPLE_EXPRESSION,
              isStatic: false,
            },
          },
        ],
      },
    ])
    expect((ir.operation[0] as IfIRNode).positive.dynamic).toMatchObject({
      id: 2,
      children: { 2: { id: 3 } },
    })
  })

  test('dedupe same template', () => {
    const { code, ir } = compileWithVIf(
      `<div v-if="ok">hello</div><div v-if="ok">hello</div>`,
    )
    expect(code).matchSnapshot()
    expect(ir.template).lengthOf(2)
  })

  test.todo('v-if with v-once')
  test.todo('component v-if')

  test.fails('v-if + v-else', () => {
    const { code, ir, vaporHelpers, helpers } = compileWithVIf(
      `<div v-if="ok"/><p v-else/>`,
    )
    expect(code).matchSnapshot()
    expect(ir.template).lengthOf(3)
    expect(ir.template).toMatchObject([
      {
        template: '<div></div>',
        type: IRNodeTypes.TEMPLATE_FACTORY,
      },
      {
        template: '<p></p>',
        type: IRNodeTypes.TEMPLATE_FACTORY,
      },
      {
        type: IRNodeTypes.FRAGMENT_FACTORY,
      },
    ])

    expect(ir.effect).toEqual([])

    expect(vaporHelpers).contains('createIf')
    expect(helpers.size).toBe(0)

    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.IF,
        id: 1,
        positive: {
          type: IRNodeTypes.BLOCK_FUNCTION,
          templateIndex: 0,
        },
        negative: {
          type: IRNodeTypes.BLOCK_FUNCTION,
          templateIndex: 1,
        },
      },
    ])
  })

  test.todo('v-if + v-else-if')
  test.todo('v-if + v-else-if + v-else')
  test.todo('comment between branches')
  describe.todo('errors')
  describe.todo('codegen')
  test.todo('v-on with v-if')
})
