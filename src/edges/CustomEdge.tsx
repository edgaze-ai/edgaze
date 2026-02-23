import { getBezierPath, EdgeProps } from 'reactflow'

export function CustomEdge({
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, selected
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  return (
    <g>
      <path
        d={edgePath}
        fill="none"
        stroke="url(#edge-gradient-cyan-pink)"
        strokeWidth={selected ? 2.5 : 1.5}
        strokeOpacity={selected ? 1 : 0.6}
      />
      <path
        d={edgePath}
        fill="none"
        stroke="url(#edge-gradient-cyan-pink)"
        strokeWidth={selected ? 8 : 6}
        strokeOpacity={0.1}
        style={{ filter: 'blur(4px)' }}
      />
    </g>
  )
}
