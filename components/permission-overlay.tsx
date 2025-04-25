"use client"

interface PermissionOverlayProps {
  onEnable: () => void
}

export default function PermissionOverlay({ onEnable }: PermissionOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[2000]">
      <div className="bg-[#222] p-8 rounded-lg max-w-[90%] w-[400px] text-center">
        <h2 className="mb-4 text-2xl font-medium text-white">Enable Motion Controls</h2>
        <p className="mb-6 text-white leading-relaxed">
          For the best 360° experience on mobile, please allow access to device motion and orientation.
        </p>
        <button
          onClick={onEnable}
          className="bg-[#2196F3] text-white border-none py-3 px-6 rounded text-base cursor-pointer transition-colors hover:bg-[#0d8bf2]"
        >
          Enable Motion Controls
        </button>
      </div>
    </div>
  )
}
