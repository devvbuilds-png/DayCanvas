interface FooterProps {
  stamped: boolean
  onStamp: () => void
  onJumpToWhiteboard: () => void
}

export default function Footer({ stamped, onStamp, onJumpToWhiteboard }: FooterProps) {
  return (
    <div className="flex items-center py-3" style={{ borderTop: '1px solid #1a1a1a' }}>
      <div className="flex-1" />

      <button
        type="button"
        onClick={onJumpToWhiteboard}
        className="flex flex-col items-center gap-0.5 transition-colors leading-none"
        style={{ color: '#2e2e2e' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#484848')}
        onMouseLeave={e => (e.currentTarget.style.color = '#2e2e2e')}
      >
        <span className="text-[10px]">whiteboard</span>
        <span aria-hidden="true" className="text-[9px] leading-none">↓</span>
      </button>

      <div className="flex-1 flex justify-end">
        {stamped ? (
          <span className="text-[11px] tnum" style={{ color: '#3a3a3a' }}>stamped ✓</span>
        ) : (
          <button
            type="button"
            onClick={onStamp}
            className="px-4 py-1.5 text-[12px] font-medium text-white rounded-md transition-colors"
            style={{ background: '#4b47a8' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#403da0')}
            onMouseLeave={e => (e.currentTarget.style.background = '#4b47a8')}
          >
            stamp the day →
          </button>
        )}
      </div>
    </div>
  )
}
