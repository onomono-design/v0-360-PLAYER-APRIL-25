"use client"

import { useEffect, useState } from "react"

interface DevToggleProps {
  onToggle: (useNativeControls: boolean) => void
}

export default function DevToggle({ onToggle }: DevToggleProps) {
  const [useNativeControls, setUseNativeControls] = useState(true)

  // Load preference from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPreference = localStorage.getItem("useNativeControls")
      if (savedPreference !== null) {
        const parsedValue = savedPreference === "true"
        setUseNativeControls(parsedValue)
        onToggle(parsedValue)
      }
    }
  }, [onToggle])

  const toggleControls = () => {
    const newValue = !useNativeControls
    setUseNativeControls(newValue)

    // Save to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("useNativeControls", String(newValue))
    }

    // Notify parent
    onToggle(newValue)
  }

  return (
    <div className="fixed top-4 right-4 z-[2000] bg-black/80 rounded-lg p-2 text-white text-xs shadow-lg backdrop-blur-sm">
      <label className="flex items-center cursor-pointer">
        <span className="mr-2">Dev Mode:</span>
        <div className="relative">
          <input type="checkbox" className="sr-only" checked={useNativeControls} onChange={toggleControls} />
          <div className={`block w-10 h-5 rounded-full ${useNativeControls ? "bg-green-400" : "bg-gray-600"}`}></div>
          <div
            className={`absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${useNativeControls ? "transform translate-x-5" : ""}`}
          ></div>
        </div>
        <span className="ml-2">{useNativeControls ? "Native Controls" : "Parent Controls"}</span>
      </label>
    </div>
  )
}
