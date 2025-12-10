/**
 * Domain Clustering Algorithm
 *
 * 도메인 후보들을 클러스터링하고 그룹화합니다.
 */

import type { DomainCandidate, DependencyGraph } from '../../analyzer/types.js';
import type { DomainSummary } from '../types.js';
import { createDomainSummary, generateId } from '../summarizer.js';

/**
 * 파일 클러스터
 */
export interface FileCluster {
  id: string;
  files: string[];
  centroid: string; // 대표 파일
  density: number;  // 0-1
  domainCandidates: string[]; // 관련 DomainCandidate IDs
}

/**
 * 클러스터링 결과
 */
export interface ClusteringResult {
  clusters: FileCluster[];
  noise: string[]; // 클러스터에 속하지 않는 파일들
  mergedDomains: DomainSummary[];
}

/**
 * Feature 디렉토리 추출 (예: features/auth/hooks/useAuth.ts → auth)
 */
function extractFeatureDirectory(filePath: string): string | null {
  // features/xxx/ 또는 domains/xxx/ 패턴 찾기
  const featureMatch = filePath.match(/(?:features|domains|modules)\/([^/]+)/);
  if (featureMatch && featureMatch[1]) {
    return featureMatch[1];
  }
  return null;
}

/**
 * 파일이 shared/common 디렉토리에 있는지 확인
 */
function isSharedFile(filePath: string): boolean {
  return /\/(shared|common|utils|lib|helpers|components\/shared)\//.test(filePath);
}

/**
 * 파일 유사도 계산 (0-1)
 * - 같은 feature 디렉토리: +0.6 (가장 강한 신호)
 * - 같은 일반 디렉토리: +0.2
 * - import 관계 (같은 feature 내): +0.3
 * - import 관계 (다른 feature): +0.05 (shared 파일은 연결하지 않음)
 * - 네이밍 유사성: +0.2
 */
export function calculateFileSimilarity(
  file1: string,
  file2: string,
  graph: DependencyGraph
): number {
  let similarity = 0;

  const feature1 = extractFeatureDirectory(file1);
  const feature2 = extractFeatureDirectory(file2);
  const isShared1 = isSharedFile(file1);
  const isShared2 = isSharedFile(file2);

  // Feature 디렉토리 유사성 (가장 중요한 신호)
  if (feature1 && feature2) {
    if (feature1 === feature2) {
      // 같은 feature 디렉토리 → 매우 강한 유사성
      similarity += 0.6;
    } else {
      // 다른 feature 디렉토리 → 패널티 (병합 방지)
      return 0;
    }
  }

  // 둘 다 shared이면 같은 클러스터에 둘 수 있음
  if (isShared1 && isShared2) {
    const dir1 = file1.substring(0, file1.lastIndexOf('/'));
    const dir2 = file2.substring(0, file2.lastIndexOf('/'));
    if (dir1 === dir2) {
      similarity += 0.4;
    }
  }

  // 하나만 shared이면 연결하지 않음 (feature와 shared 분리)
  if (isShared1 !== isShared2) {
    return 0;
  }

  // 일반 디렉토리 유사성 (feature가 없는 경우)
  if (!feature1 && !feature2 && !isShared1 && !isShared2) {
    const dir1 = file1.substring(0, file1.lastIndexOf('/'));
    const dir2 = file2.substring(0, file2.lastIndexOf('/'));

    if (dir1 === dir2) {
      similarity += 0.3;
    } else if (dir1.startsWith(dir2) || dir2.startsWith(dir1)) {
      similarity += 0.15;
    }
  }

  // Import 관계 확인 (같은 feature 내에서만 높은 가중치)
  const hasDirectImport = graph.edges.some(
    e => (e.source === file1 && e.target === file2) ||
         (e.source === file2 && e.target === file1)
  );

  if (hasDirectImport) {
    // 같은 feature 내의 import만 높은 가중치
    if (feature1 && feature1 === feature2) {
      similarity += 0.3;
    } else if (!feature1 && !feature2 && !isShared1 && !isShared2) {
      // feature 디렉토리가 없는 파일들 간의 import
      similarity += 0.2;
    }
    // shared 파일을 import하는 것은 유사도에 거의 영향 없음
  }

  // 네이밍 유사성 (간단한 휴리스틱)
  const name1 = file1.split('/').pop()?.replace(/\.(tsx?|jsx?)$/, '') ?? '';
  const name2 = file2.split('/').pop()?.replace(/\.(tsx?|jsx?)$/, '') ?? '';

  const commonPrefix = findCommonPrefix(name1, name2);
  if (commonPrefix.length >= 3) {
    similarity += Math.min(0.2, commonPrefix.length / Math.max(name1.length, name2.length) * 0.2);
  }

  return Math.min(similarity, 1);
}

/**
 * 공통 접두사 찾기
 */
function findCommonPrefix(s1: string, s2: string): string {
  let i = 0;
  while (i < s1.length && i < s2.length && s1[i] === s2[i]) {
    i++;
  }
  return s1.substring(0, i);
}

/**
 * DBSCAN 스타일 클러스터링
 */
export function clusterFiles(
  files: string[],
  graph: DependencyGraph,
  minClusterSize: number = 2,
  similarityThreshold: number = 0.5
): ClusteringResult {
  const clusters: FileCluster[] = [];
  const visited = new Set<string>();
  const noise: string[] = [];

  // 유사도 행렬 구축 (캐시용)
  const similarityCache = new Map<string, number>();

  function getSimilarity(f1: string, f2: string): number {
    const key = f1 < f2 ? `${f1}|${f2}` : `${f2}|${f1}`;
    if (!similarityCache.has(key)) {
      similarityCache.set(key, calculateFileSimilarity(f1, f2, graph));
    }
    return similarityCache.get(key)!;
  }

  // 이웃 찾기
  function getNeighbors(file: string): string[] {
    return files.filter(f =>
      f !== file && getSimilarity(file, f) >= similarityThreshold
    );
  }

  // 클러스터 확장
  function expandCluster(
    file: string,
    neighbors: string[],
    cluster: FileCluster
  ): void {
    cluster.files.push(file);
    visited.add(file);

    const queue = [...neighbors];
    while (queue.length > 0) {
      const neighbor = queue.shift()!;
      if (visited.has(neighbor)) continue;

      visited.add(neighbor);
      cluster.files.push(neighbor);

      const neighborNeighbors = getNeighbors(neighbor);
      if (neighborNeighbors.length >= minClusterSize - 1) {
        for (const nn of neighborNeighbors) {
          if (!visited.has(nn) && !queue.includes(nn)) {
            queue.push(nn);
          }
        }
      }
    }
  }

  // 클러스터링 실행
  for (const file of files) {
    if (visited.has(file)) continue;

    const neighbors = getNeighbors(file);
    if (neighbors.length >= minClusterSize - 1) {
      const cluster: FileCluster = {
        id: `cluster-${generateId()}`,
        files: [],
        centroid: file,
        density: 0,
        domainCandidates: [],
      };

      expandCluster(file, neighbors, cluster);

      // Centroid 선택 (가장 많은 연결을 가진 파일)
      let maxConnections = 0;
      for (const f of cluster.files) {
        const connections = cluster.files.filter(
          other => getSimilarity(f, other) >= similarityThreshold
        ).length;
        if (connections > maxConnections) {
          maxConnections = connections;
          cluster.centroid = f;
        }
      }

      // Density 계산
      const possibleEdges = cluster.files.length * (cluster.files.length - 1) / 2;
      let actualEdges = 0;
      for (let i = 0; i < cluster.files.length; i++) {
        for (let j = i + 1; j < cluster.files.length; j++) {
          if (getSimilarity(cluster.files[i]!, cluster.files[j]!) >= similarityThreshold) {
            actualEdges++;
          }
        }
      }
      cluster.density = possibleEdges > 0 ? actualEdges / possibleEdges : 0;

      clusters.push(cluster);
    } else {
      visited.add(file);
      noise.push(file);
    }
  }

  return {
    clusters,
    noise,
    mergedDomains: [],
  };
}

/**
 * DomainCandidate를 클러스터에 매핑
 */
export function mapCandidatesToClusters(
  candidates: DomainCandidate[],
  clusters: FileCluster[]
): FileCluster[] {
  return clusters.map(cluster => {
    const clusterFiles = new Set(cluster.files);
    const matchingCandidates = candidates.filter(c =>
      c.sourceFiles.some(f => clusterFiles.has(f))
    );

    return {
      ...cluster,
      domainCandidates: matchingCandidates.map(c => c.id),
    };
  });
}

/**
 * 클러스터 병합
 * 같은 feature 디렉토리에 있는 클러스터들만 병합
 * (DomainCandidate 공유는 더 이상 병합 조건이 아님)
 */
export function mergeClusters(clusters: FileCluster[]): FileCluster[] {
  const merged: FileCluster[] = [];
  const processed = new Set<string>();

  // 클러스터의 주요 feature 디렉토리 추출
  function getClusterFeature(cluster: FileCluster): string | null {
    const featureCounts = new Map<string, number>();
    for (const file of cluster.files) {
      const featureMatch = file.match(/(?:features|domains|modules)\/([^/]+)/);
      if (featureMatch && featureMatch[1]) {
        const feature = featureMatch[1];
        featureCounts.set(feature, (featureCounts.get(feature) ?? 0) + 1);
      }
    }

    // 가장 많은 파일을 가진 feature 반환
    let maxFeature: string | null = null;
    let maxCount = 0;
    for (const [feature, count] of featureCounts) {
      if (count > maxCount) {
        maxCount = count;
        maxFeature = feature;
      }
    }
    return maxFeature;
  }

  for (const cluster of clusters) {
    if (processed.has(cluster.id)) continue;

    const clusterFeature = getClusterFeature(cluster);

    // 같은 feature 디렉토리의 클러스터만 병합 (더 엄격한 조건)
    const toMerge = clusters.filter(c => {
      if (c.id === cluster.id || processed.has(c.id)) return false;

      const otherFeature = getClusterFeature(c);

      // 둘 다 feature가 있고 같은 feature인 경우만 병합
      if (clusterFeature && otherFeature && clusterFeature === otherFeature) {
        return true;
      }

      return false;
    });

    if (toMerge.length > 0) {
      const allFiles = new Set([
        ...cluster.files,
        ...toMerge.flatMap(c => c.files),
      ]);
      const allCandidates = new Set([
        ...cluster.domainCandidates,
        ...toMerge.flatMap(c => c.domainCandidates),
      ]);

      merged.push({
        id: cluster.id,
        files: [...allFiles],
        centroid: cluster.centroid,
        density: cluster.density,
        domainCandidates: [...allCandidates],
      });

      processed.add(cluster.id);
      for (const c of toMerge) {
        processed.add(c.id);
      }
    } else {
      merged.push(cluster);
      processed.add(cluster.id);
    }
  }

  return merged;
}

/**
 * 클러스터를 DomainSummary로 변환
 */
export function clustersToDomainSummaries(
  clusters: FileCluster[],
  candidates: DomainCandidate[]
): DomainSummary[] {
  return clusters.map(cluster => {
    // 클러스터와 관련된 DomainCandidate들 찾기
    const relatedCandidates = candidates.filter(c =>
      cluster.domainCandidates.includes(c.id)
    );

    // 가장 높은 신뢰도의 candidate 선택
    const bestCandidate = relatedCandidates.reduce<DomainCandidate | null>(
      (best, current) => {
        if (!best) return current;
        return current.confidence > best.confidence ? current : best;
      },
      null
    );

    if (bestCandidate) {
      const summary = createDomainSummary(bestCandidate);
      return {
        ...summary,
        sourceFiles: [...new Set([...cluster.files, ...bestCandidate.sourceFiles])],
      };
    }

    // candidate가 없으면 클러스터 기반으로 생성
    const centroidName = cluster.centroid
      .split('/')
      .pop()
      ?.replace(/\.(tsx?|jsx?)$/, '')
      ?? 'unknown';

    return {
      id: `domain-${cluster.id}`,
      name: centroidName.toLowerCase(),
      description: `Domain inferred from file cluster`,
      sourceFiles: cluster.files,
      entities: [],
      actions: [],
      boundaries: { imports: [], exports: [], sharedState: [] },
      suggestedBy: cluster.id,
      confidence: cluster.density * 0.7, // density 기반 신뢰도
      needsReview: true,
      reviewNotes: ['Domain inferred from file clustering, needs review'],
    };
  });
}

/**
 * 전체 클러스터링 파이프라인
 */
export function performClustering(
  candidates: DomainCandidate[],
  graph: DependencyGraph,
  minClusterSize: number = 2
): ClusteringResult {
  // 1. 모든 파일 수집
  const allFiles = [...new Set(candidates.flatMap(c => c.sourceFiles))];

  // 2. 파일 클러스터링
  const initialResult = clusterFiles(allFiles, graph, minClusterSize);

  // 3. DomainCandidate 매핑
  const mappedClusters = mapCandidatesToClusters(candidates, initialResult.clusters);

  // 4. 클러스터 병합
  const mergedClusters = mergeClusters(mappedClusters);

  // 5. DomainSummary 생성
  const mergedDomains = clustersToDomainSummaries(mergedClusters, candidates);

  return {
    clusters: mergedClusters,
    noise: initialResult.noise,
    mergedDomains,
  };
}
