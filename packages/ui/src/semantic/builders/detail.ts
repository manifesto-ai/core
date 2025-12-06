import {
  type DetailSemanticContract,
  type DetailSemanticNode,
  type SemanticBuildOptions,
} from '../types'
import { buildFormSemanticTree } from './form'

/**
 * Detail builder는 Form 빌더를 재사용하되 kind만 'detail'로 덮어쓴다.
 * Detail 스키마가 도입되면 별도 구현으로 교체할 수 있다.
 */
export const buildDetailSemanticTree = (
  contract: DetailSemanticContract,
  options?: SemanticBuildOptions
): DetailSemanticNode => {
  const formTree = buildFormSemanticTree(
    {
      kind: 'form',
      view: contract.view,
      state: contract.state,
    },
    options
  )

  return {
    ...formTree,
    kind: 'detail',
  }
}
