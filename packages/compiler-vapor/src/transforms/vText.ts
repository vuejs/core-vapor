import { DOMErrorCodes, createDOMCompilerError } from '@vue/compiler-dom'
import { DirectiveTransform } from '../transform'
import { IRNodeTypes } from '../ir'

export const transformVText: DirectiveTransform = (dir, node, context) => {
  const { exp, loc } = dir
  if (!exp) {
    context.options.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_TEXT_NO_EXPRESSION, loc),
    )
  }
  if (node.children.length) {
    context.options.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_TEXT_WITH_CHILDREN, loc),
    )
    node.children.length = 0
  }

  context.registerEffect(
    [exp],
    [
      {
        type: IRNodeTypes.SET_TEXT,
        loc: dir.loc,
        element: context.reference(),
        value: exp || '""',
      },
    ],
  )
}
