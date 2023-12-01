import type { Prettify } from '@vue/shared'
import type { NodeTransform } from './transform'

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> &
  Pick<U, Extract<keyof U, keyof T>>

export type HackOptions<T> = Prettify<
  Overwrite<T, { nodeTransforms?: NodeTransform[] }>
>