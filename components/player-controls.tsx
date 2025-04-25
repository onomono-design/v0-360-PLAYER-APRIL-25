"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { formatTime } from "@/lib/utils"

interface PlayerControlsProps {
  isPlaying: boolean
  isMuted: boolean
  currentTime: number
  duration: number
  sceneName: string
  playlistName: string
  onPlayPause: () => void
  onMute: () => void
  onSeek: (value: number) => void
  onSkipForward: () => void
  onSkipBackward: () => void
  onRecenter: () => void
}

export default function PlayerControls({
  isPlaying,
  isMuted,
  currentTime,
  duration,
  sceneName,
  playlistName,
  onPlayPause,
  onMute,
  onSeek,
  onSkipForward,
  onSkipBackward,
  onRecenter,
}: PlayerControlsProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [localPercentage, setLocalPercentage] = useState(0)
  const scrubberRef = useRef<HTMLDivElement>(null)
  const scrubberTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Calculate percentage based on current time and duration
  const percentage = isDragging ? localPercentage : (currentTime / Math.max(1, duration)) * 100

  // Update local percentage when current time changes (if not dragging)
  useEffect(() => {
    if (!isDragging) {
      setLocalPercentage((currentTime / Math.max(1, duration)) * 100)
    }
  }, [currentTime, duration, isDragging])

  // Clean up any timeouts on unmount
  useEffect(() => {
    return () => {
      if (scrubberTimeoutRef.current) {
        clearTimeout(scrubberTimeoutRef.current)
      }
    }
  }, [])

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrubberRef.current) return

    // Prevent any lingering drag state
    setIsDragging(false)

    const rect = scrubberRef.current.getBoundingClientRect()
    const position = (e.clientX - rect.left) / rect.width
    const clampedPosition = Math.max(0, Math.min(position, 1))

    setLocalPercentage(clampedPosition * 100)
    onSeek(clampedPosition * 100)
  }

  // Update the handleDragStart function to ensure it properly sets up event listeners for both mouse and touch events
  const handleDragStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)

    // Get initial position
    updateDragPosition(e)

    // Add document-level event listeners for dragging
    if (e.type === "mousedown") {
      document.addEventListener("mousemove", handleDragMove)
      document.addEventListener("mouseup", handleDragEnd)
    }
    // Touch events are handled in the useEffect
  }

  // Update the updateDragPosition function to ensure it properly calculates the position
  const updateDragPosition = (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement> | MouseEvent | TouchEvent,
  ) => {
    if (!scrubberRef.current) return

    const rect = scrubberRef.current.getBoundingClientRect()

    // Get clientX from either mouse or touch event
    let clientX: number

    if ("touches" in e) {
      // Touch event
      clientX = e.touches[0].clientX
    } else {
      // Mouse event
      clientX = (e as MouseEvent).clientX
    }

    const position = (clientX - rect.left) / rect.width
    const clampedPosition = Math.max(0, Math.min(position, 1)) * 100

    // Update local percentage state
    setLocalPercentage(clampedPosition)
    console.log("Drag position updated:", clampedPosition)
  }

  // Update the handleDragMove function to ensure it calls updateDragPosition
  const handleDragMove = (e: MouseEvent | TouchEvent) => {
    if (isDragging && scrubberRef.current) {
      e.preventDefault()
      updateDragPosition(e)
    }
  }

  const handleDragEnd = () => {
    if (!isDragging) return

    // Store the final position before resetting isDragging
    const finalPosition = localPercentage

    // Reset dragging state
    setIsDragging(false)

    // Clean up event listeners
    document.removeEventListener("mousemove", handleDragMove)
    document.removeEventListener("mouseup", handleDragEnd)

    // Add a small delay before seeking to ensure UI updates first
    if (scrubberTimeoutRef.current) {
      clearTimeout(scrubberTimeoutRef.current)
    }

    // Apply the seek position
    console.log("Seeking to position:", finalPosition)
    onSeek(finalPosition)
  }

  // Update the useEffect for touch events to ensure it properly handles touch move events
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging && scrubberRef.current) {
        e.preventDefault()
        updateDragPosition(e)
      }
    }

    const handleTouchEnd = () => {
      handleDragEnd()
    }

    if (isDragging) {
      document.addEventListener("touchmove", handleTouchMove, { passive: false })
      document.addEventListener("touchend", handleTouchEnd)
    }

    return () => {
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleTouchEnd)
    }
  }, [isDragging])

  return (
    <div className="fixed bottom-0 left-0 w-full bg-black/70 p-4 z-[1000]">
      <div className="flex justify-center mb-2.5">
        <div className="text-white text-base">
          <span className="scene-name">{sceneName}</span>
          <span className="mx-2.5 text-gray-500">|</span>
          <span className="playlist-name">{playlistName}</span>
        </div>
      </div>

      <div className="flex items-center mb-4">
        <span className="text-white text-sm w-[45px] text-center">
          {isDragging ? formatTime((duration / 100) * localPercentage) : formatTime(currentTime)}
        </span>

        {/* Improved scrubber with larger touch area and visible thumb */}
        <div
          ref={scrubberRef}
          className="flex-grow h-8 flex items-center px-2 cursor-pointer touch-none select-none"
          onClick={handleScrubberClick}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <div className="relative w-full h-2 bg-[#333] rounded-full">
            {/* Progress bar */}
            <div className="absolute h-full bg-[#2196F3] rounded-full" style={{ width: `${percentage}%` }} />

            {/* Draggable thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md transform -translate-x-1/2 border-2 border-[#2196F3]"
              style={{ left: `${percentage}%` }}
            />

            {/* Preview position indicator (only visible during drag) */}
            {isDragging && (
              <div
                className="absolute bottom-6 left-0 bg-black/80 text-white text-xs py-1 px-2 rounded transform -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${localPercentage}%` }}
              >
                {formatTime((duration / 100) * localPercentage)}
              </div>
            )}
          </div>
        </div>

        <span className="text-white text-sm w-[45px] text-center">{formatTime(duration)}</span>
      </div>

      <div className="flex justify-center gap-2.5">
        <div>
          <button
            onClick={onRecenter}
            className="bg-transparent border-none text-white text-xl cursor-pointer w-10 h-10 flex items-center justify-center rounded-full transition-colors hover:bg-white/10"
          >
            <i className="fas fa-sync-alt"></i>
          </button>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={onSkipBackward}
            className="bg-transparent border-none text-white text-xl cursor-pointer w-10 h-10 flex items-center justify-center rounded-full transition-colors hover:bg-white/10"
          >
            <i className="fas fa-backward"></i>
          </button>
          <button
            onClick={onPlayPause}
            className="bg-white/20 border-none text-white text-xl cursor-pointer w-12 h-12 flex items-center justify-center rounded-full transition-colors hover:bg-white/30"
          >
            <i className={`fas ${isPlaying ? "fa-pause" : "fa-play"}`}></i>
          </button>
          <button
            onClick={onSkipForward}
            className="bg-transparent border-none text-white text-xl cursor-pointer w-10 h-10 flex items-center justify-center rounded-full transition-colors hover:bg-white/10"
          >
            <i className="fas fa-forward"></i>
          </button>
        </div>
        <div>
          <button
            onClick={onMute}
            className={`bg-transparent border-none ${isMuted ? "text-red-500" : "text-white"} text-xl cursor-pointer w-10 h-10 flex items-center justify-center rounded-full transition-colors hover:bg-white/10`}
          >
            <i className={`fas ${isMuted ? "fa-volume-mute" : "fa-volume-up"}`}></i>
          </button>
        </div>
      </div>
    </div>
  )
}
