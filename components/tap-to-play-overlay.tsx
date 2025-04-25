"use client"

interface TapToPlayOverlayProps {
  onTap: () => void
}

export default function TapToPlayOverlay({ onTap }: TapToPlayOverlayProps) {
  return (
    <div
      className="fixed inset-0 bg-black/70 flex flex-col items-center justify-center z-[1500] cursor-pointer backdrop-blur-sm"
      onClick={onTap}
    >
      <div className="text-center p-6 max-w-md">
        <div className="text-3xl font-semibold mb-4 text-white">360° Video Experience</div>
        <p className="text-xl text-white/90 mb-8">
          Immerse yourself in a 360° environment. Look around by dragging or moving your device.
        </p>
        <div className="inline-flex items-center justify-center gap-2 bg-white/10 text-white py-3 px-6 rounded-full border border-white/20 hover:bg-white/20 transition-colors">
          <i className="fas fa-play"></i>
          <span className="font-medium">Tap anywhere to play</span>
        </div>
      </div>
    </div>
  )
}
