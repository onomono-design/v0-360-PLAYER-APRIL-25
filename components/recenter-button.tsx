"use client"

interface RecenterButtonProps {
  onRecenter: () => void
  showTapToPlay?: boolean
}

export default function RecenterButton({ onRecenter, showTapToPlay = false }: RecenterButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onRecenter()
      }}
      className={`absolute top-5 left-1/2 transform -translate-x-1/2 bg-black/70 text-white border-none py-2.5 px-4 rounded cursor-pointer text-base flex items-center gap-2 active:bg-[rgba(33,150,243,0.9)] active:scale-[0.98] transition-opacity ${
        showTapToPlay ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ zIndex: 1000 }} // Lower z-index than tap-to-play overlay (1500)
    >
      <i className="fas fa-compass"></i> Recenter View
    </button>
  )
}
