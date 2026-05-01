interface FooterProps {
  stamped: boolean
  onStamp: () => void
}

export default function Footer({ stamped, onStamp }: FooterProps) {
  return (
    <div className="flex items-center justify-between py-3 border-t border-[#2a2a2a]">
      {/* left ghost buttons */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="px-3 py-1.5 text-xs text-[#888] border border-[#2a2a2a] rounded hover:bg-[#252525] hover:text-[#e3e3e3] transition-colors"
        >
          stickers
        </button>
        <button
          type="button"
          className="px-3 py-1.5 text-xs text-[#888] border border-[#2a2a2a] rounded hover:bg-[#252525] hover:text-[#e3e3e3] transition-colors"
        >
          scratch
        </button>
      </div>

      {/* right: stamp button or confirmation */}
      {stamped ? (
        <span className="text-xs text-[#888]">day stamped ✓</span>
      ) : (
        <button
          type="button"
          onClick={onStamp}
          className="px-3 py-1.5 text-xs font-medium text-white bg-[#534AB7] rounded hover:bg-[#4840a3] transition-colors"
        >
          stamp the day →
        </button>
      )}
    </div>
  )
}
