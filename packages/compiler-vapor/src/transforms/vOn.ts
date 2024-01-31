import {
  ElementTypes,
  ErrorCodes,
  createCompilerError,
} from '@vue/compiler-dom'
import type { DirectiveTransform } from '../transform'
import { IRNodeTypes, type KeyOverride, type SetEventIRNode } from '../ir'
import { resolveModifiers } from '@vue/compiler-dom'
import { camelize, extend } from '@vue/shared'

export const transformVOn: DirectiveTransform = (dir, node, context) => {
  let { arg, exp, loc, modifiers } = dir
  if (!exp && !modifiers.length) {
    context.options.onError(
      createCompilerError(ErrorCodes.X_V_ON_NO_EXPRESSION, loc),
    )
  }

  if (!arg) {
    // TODO support v-on="{}"
    return
  }

  if (arg.isStatic) {
    let rawName = arg.content
    if (__DEV__ && rawName.startsWith('vnode')) {
      context.options.onError(
        createCompilerError(ErrorCodes.X_VNODE_HOOKS, arg.loc),
      )
    }

    if (
      node.tagType !== ElementTypes.ELEMENT ||
      rawName.startsWith('vnode') ||
      !/[A-Z]/.test(rawName)
    ) {
      arg.content = camelize(arg.content)
    }
  }

  const { keyModifiers, nonKeyModifiers, eventOptionModifiers } =
    resolveModifiers(
      arg.isStatic ? `on${arg.content}` : arg,
      modifiers,
      null,
      loc,
    )

  let keyOverride: KeyOverride | undefined

  // normalize click.right and click.middle since they don't actually fire

  const isStaticClick = arg.isStatic && arg.content.toLowerCase() === 'click'

  if (nonKeyModifiers.includes('right')) {
    if (isStaticClick) {
      arg = extend({}, arg, { content: 'contextmenu' })
    } else if (!arg.isStatic) {
      keyOverride = ['click', 'contextmenu']
    }
  }
  if (nonKeyModifiers.includes('middle')) {
    if (keyOverride) {
      // TODO error here
    }
    if (isStaticClick) {
      arg = extend({}, arg, { content: 'mouseup' })
    } else if (!arg.isStatic) {
      keyOverride = ['click', 'mouseup']
    }
  }

  const operation: SetEventIRNode = {
    type: IRNodeTypes.SET_EVENT,
    element: context.reference(),
    key: arg,
    value: exp,
    modifiers: {
      keys: keyModifiers,
      nonKeys: nonKeyModifiers,
      options: eventOptionModifiers,
    },
    keyOverride,
  }

  if (arg.isStatic) {
    context.registerOperation(operation)
  } else {
    context.registerEffect([arg], [operation])
  }
}
