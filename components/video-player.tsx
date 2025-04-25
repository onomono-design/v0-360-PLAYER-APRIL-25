"use client"

import { useEffect, useRef, useState } from "react"
import Script from "next/script"
import PermissionOverlay from "./permission-overlay"
import PlayerControls from "./player-controls"
import LoadingMessage from "./loading-message"
import RecenterButton from "./recenter-button"
import TapToPlayOverlay from "./tap-to-play-overlay"
import DevToggle from "./dev-toggle"

// Define types for our configuration
interface TeaserCTA {
  timeIn: string
  backlink: string
  text: string
}

interface ChapterNavigation {
  next: string
  prev: string
}

interface CMSMetadata {
  collectionId: string
  localeId: string
  itemId: string
  createdOn: string
  updatedOn: string
  publishedOn: string
}

interface ChapterConfig {
  id: string
  number: string
  slug: string
  trackOrder: string
  trackName: string
  trackDuration: string
  thumbnail: string
  audioSrc: string
  xrSrc: string
  isXR: boolean
  isGallery: boolean
  doesGalleryLoop: boolean
  isTeaser: boolean
  teaserCTA: TeaserCTA
  navigation: ChapterNavigation
  cms: CMSMetadata
  slideshow: string | null
}

interface PlayerConfig {
  VIDEO_360_SOURCE: string
  chapter: ChapterConfig
}

// Add props to allow headless mode to be passed in
interface VideoPlayerProps {
  initialHeadless?: boolean
}

export default function VideoPlayer({ initialHeadless = false }: VideoPlayerProps) {
  const [isAFrameLoaded, setIsAFrameLoaded] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showLoading, setShowLoading] = useState(true)
  const [showPermission, setShowPermission] = useState(false)
  const [devicePermissionGranted, setDevicePermissionGranted] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [showTapToPlay, setShowTapToPlay] = useState(true)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [isSeeking, setIsSeeking] = useState(false)
  const [wasPlayingBeforeSeek, setWasPlayingBeforeSeek] = useState(false)

  // Add state for headless mode
  const [headless, setHeadless] = useState(initialHeadless)
  const [externallyControlled, setExternallyControlled] = useState(initialHeadless)
  const [showDevToggle, setShowDevToggle] = useState(false)

  // Add state for chapter information
  const [chapterName, setChapterName] = useState("Chapter 1: Chinatown Memories")
  const [playlistName, setPlaylistName] = useState("Look Up")
  const [playerConfig, setPlayerConfig] = useState<PlayerConfig | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const sceneRef = useRef<any>(null)
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const seekingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSeekPositionRef = useRef<number | null>(null)
  const configReceivedRef = useRef<boolean>(false)
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastSyncTimeRef = useRef<number>(0)

  // Check if we're in development mode
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Check if we're in development mode (localhost or specific query param)
      const isDev =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.search.includes("dev=true")

      setShowDevToggle(isDev)

      // Check for headless mode in URL
      const urlParams = new URLSearchParams(window.location.search)
      const headlessParam = urlParams.get("headless")
      if (headlessParam === "true") {
        setHeadless(true)
        setExternallyControlled(true)
      }
    }
  }, [])

  // Handle dev toggle changes
  const handleDevToggle = (useNativeControls: boolean) => {
    setHeadless(!useNativeControls)
    setExternallyControlled(!useNativeControls)

    // If switching to native controls, make sure we're not in tap-to-play state
    if (useNativeControls && showTapToPlay) {
      setShowTapToPlay(false)
    }

    console.log(`Switched to ${useNativeControls ? "native" : "parent"} controls mode`)
  }

  // Function to get video source from parent window or use default
  const getVideoSource = () => {
    try {
      // First try player config from state (set via postMessage)
      if (playerConfig && playerConfig.VIDEO_360_SOURCE) {
        console.log("Using video source from player config:", playerConfig.VIDEO_360_SOURCE)
        return playerConfig.VIDEO_360_SOURCE
      }

      // Then try parent window communication (may be blocked by CORS)
      if (typeof window !== "undefined" && window.parent && window.parent !== window) {
        try {
          // Try to access parent window properties
          if (window.parent.VIDEO_360_SOURCE) {
            console.log("Using video source from parent window:", window.parent.VIDEO_360_SOURCE)
            return window.parent.VIDEO_360_SOURCE
          }

          // Try to access the XR_PLAYER_CONFIG
          if (window.parent.XR_PLAYER_CONFIG && window.parent.XR_PLAYER_CONFIG.chapter.xrSrc) {
            console.log("Using video source from XR_PLAYER_CONFIG:", window.parent.XR_PLAYER_CONFIG.chapter.xrSrc)

            // Also update chapter name and playlist name
            if (window.parent.XR_PLAYER_CONFIG.chapter.trackName) {
              setChapterName(window.parent.XR_PLAYER_CONFIG.chapter.trackName)
            }

            if (window.parent.XR_PLAYER_CONFIG.chapter.trackOrder) {
              setPlaylistName(`Chapter ${window.parent.XR_PLAYER_CONFIG.chapter.trackOrder}`)
            }

            return window.parent.XR_PLAYER_CONFIG.chapter.xrSrc
          }
        } catch (e) {
          console.log("Could not access parent window properties due to CORS restrictions:", e)
          // Continue to default source
        }
      }
    } catch (error) {
      console.log("Error getting video source:", error)
    }

    // Default video source if not provided by parent
    return "https://cmm-cloud-storage.s3.us-east-2.amazonaws.com/2025-03-08-JAPANTOWN-XR1-LOW.mp4"
  }

  // Function to update video source when config is received
  const updateVideoSource = (source: string) => {
    if (videoRef.current) {
      const sourceElement = videoRef.current.querySelector("source")
      if (sourceElement) {
        sourceElement.setAttribute("src", source)
        videoRef.current.load()
        console.log("Video source updated to:", source)
      }
    }
  }

  // Check if this is a mobile browser
  const isMobile =
    typeof navigator !== "undefined"
      ? /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      : false

  // Function to hide loading after a delay
  const hideLoadingWithDelay = (delay = 500) => {
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current)
    }

    loadingTimerRef.current = setTimeout(() => {
      setShowLoading(false)
    }, delay)
  }

  // Function to start the time update interval
  const startTimeUpdateInterval = () => {
    // Clear any existing interval first
    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current)
    }

    // Set up a new interval
    timeUpdateIntervalRef.current = setInterval(() => {
      if (videoRef.current && !isSeeking) {
        setCurrentTime(videoRef.current.currentTime)
      }
    }, 100) // Update every 100ms for smoother scrubber movement

    console.log("Started time update interval")
  }

  // Function to stop the time update interval
  const stopTimeUpdateInterval = () => {
    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current)
      timeUpdateIntervalRef.current = null
      console.log("Stopped time update interval")
    }
  }

  // Initial setup
  useEffect(() => {
    // Force hide loading after a maximum time to prevent it getting stuck
    const maxLoadingTimer = setTimeout(() => {
      console.log("Force hiding loading message after timeout")
      setShowLoading(false)
    }, 8000)

    // Prevent touchmove default behavior to disable scrolling
    const preventScroll = (e: TouchEvent) => {
      e.preventDefault()
    }

    document.addEventListener("touchmove", preventScroll, { passive: false })

    // Send ready message to parent
    if (typeof window !== "undefined" && window.parent && window.parent !== window) {
      try {
        console.log("Sending PLAYER_READY message to parent")
        window.parent.postMessage(
          {
            type: "PLAYER_READY",
            capabilities: {
              recenter: true,
              fullscreen: false,
              mute: true,
            },
          },
          "*",
        )
      } catch (e) {
        console.log("Could not send ready message to parent:", e)
      }
    }

    return () => {
      clearTimeout(maxLoadingTimer)
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current)
      }
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current)
      }
      if (seekingTimeoutRef.current) {
        clearTimeout(seekingTimeoutRef.current)
      }
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
      document.removeEventListener("touchmove", preventScroll)
    }
  }, [])

  // Handle first user interaction
  const handleFirstInteraction = () => {
    setHasInteracted(true)

    // Check if we need to request device orientation permission on mobile
    if (
      isMobile &&
      typeof window !== "undefined" &&
      typeof (window as any).DeviceOrientationEvent !== "undefined" &&
      typeof (window as any).DeviceOrientationEvent.requestPermission === "function" &&
      !devicePermissionGranted
    ) {
      // Show permission overlay instead of starting playback
      setShowPermission(true)
    } else {
      // No permission needed, proceed with playback
      setShowTapToPlay(false)

      // Unmute the video
      if (videoRef.current) {
        videoRef.current.muted = false
        setIsMuted(false)
      }

      // Start playing
      attemptAutoPlay()
    }
  }

  // Function to request device orientation permission
  const requestDeviceOrientationPermission = () => {
    if (
      typeof window !== "undefined" &&
      typeof (window as any).DeviceOrientationEvent !== "undefined" &&
      typeof (window as any).DeviceOrientationEvent.requestPermission === "function"
    ) {
      ;(window as any).DeviceOrientationEvent.requestPermission()
        .then((permissionState: string) => {
          if (permissionState === "granted") {
            console.log("Device orientation permission granted")
            setDevicePermissionGranted(true)

            // Enable device orientation in A-Frame now that we have permission
            if (sceneRef.current) {
              enableDeviceOrientation(sceneRef.current)
            }
          }

          // Hide the permission overlay
          setShowPermission(false)

          // Hide tap to play overlay and start playback
          setShowTapToPlay(false)

          // Unmute the video
          if (videoRef.current) {
            videoRef.current.muted = false
            setIsMuted(false)
          }

          // Start playing
          attemptAutoPlay()
        })
        .catch((error: Error) => {
          console.error("Error requesting device orientation permission:", error)

          // Still hide the overlay and proceed with playback even if permission failed
          setShowPermission(false)
          setShowTapToPlay(false)

          // Unmute and play
          if (videoRef.current) {
            videoRef.current.muted = false
            setIsMuted(false)
            attemptAutoPlay()
          }
        })
    } else {
      // For devices that don't need permission
      setShowPermission(false)
      setShowTapToPlay(false)

      // Unmute and play
      if (videoRef.current) {
        videoRef.current.muted = false
        setIsMuted(false)
        attemptAutoPlay()
      }
    }
  }

  // Function to enable device orientation in A-Frame
  const enableDeviceOrientation = (scene: any) => {
    if (scene) {
      const camera = scene.querySelector("[camera]")
      if (camera && camera.components && camera.components["look-controls"]) {
        camera.components["look-controls"].data.magicWindowTrackingEnabled = true
      }
    }
  }

  // Function to attempt auto-play
  const attemptAutoPlay = () => {
    if (videoRef.current) {
      videoRef.current.play().catch((err) => {
        console.log("Auto-play prevented. User interaction needed:", err)
      })
      updatePlayState()
    }
  }

  // Toggle play/pause
  const togglePlayPause = () => {
    if (externallyControlled) {
      console.log("Play/pause controlled by parent, ignoring local toggle")
      return
    }

    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
        stopTimeUpdateInterval()
      } else {
        // If this is the first play, unmute the video
        if (!hasInteracted) {
          videoRef.current.muted = false
          setIsMuted(false)
          setHasInteracted(true)
        }

        videoRef.current
          .play()
          .then(() => {
            // Start the interval when play is successful
            startTimeUpdateInterval()
          })
          .catch((err) => {
            console.error("Error playing video:", err)
          })
      }
      updatePlayState()
    }
  }

  // Update play state
  const updatePlayState = () => {
    if (videoRef.current) {
      const newPlayingState = !videoRef.current.paused
      setIsPlaying(newPlayingState)

      // If video starts playing, hide loading and ensure interval is running
      if (newPlayingState && videoReady) {
        hideLoadingWithDelay(100)
        startTimeUpdateInterval()
      } else if (!newPlayingState) {
        // If video is paused, stop the interval
        stopTimeUpdateInterval()
      }
    }
  }

  // Toggle mute
  const toggleMute = () => {
    if (externallyControlled) {
      console.log("Mute controlled by parent, ignoring local toggle")
      return
    }

    if (videoRef.current) {
      const newMutedState = !isMuted
      videoRef.current.muted = newMutedState
      setIsMuted(newMutedState)
    }
  }

  // Handle seeking - completely rewritten to match the approach in the shared component
  const handleSeek = (percentage: number) => {
    if (externallyControlled) {
      console.log("Seeking controlled by parent, ignoring local seek")
      return
    }

    if (videoRef.current && !isNaN(duration) && duration > 0) {
      // Store if the video was playing before seeking
      setWasPlayingBeforeSeek(isPlaying)

      // Pause the video during seeking to prevent issues
      if (isPlaying && videoRef.current) {
        videoRef.current.pause()
      }

      // Set seeking state to true
      setIsSeeking(true)
      setShowLoading(true)

      // Calculate the seek time
      const seekTime = (duration / 100) * percentage

      console.log(`Seeking to ${seekTime}s (${percentage}% of ${duration}s)`)

      // Update current time immediately for UI responsiveness
      setCurrentTime(seekTime)

      // Update video position - this is the critical part
      try {
        videoRef.current.currentTime = seekTime
      } catch (err) {
        console.error("Error setting currentTime:", err)
      }

      // Set a timeout to reset seeking state in case the 'seeked' event doesn't fire
      if (seekingTimeoutRef.current) {
        clearTimeout(seekingTimeoutRef.current)
      }

      seekingTimeoutRef.current = setTimeout(() => {
        console.log("Seeking timeout - force reset seeking state")
        setIsSeeking(false)
        setShowLoading(false)

        // Resume playback if it was playing before seeking
        if (wasPlayingBeforeSeek && videoRef.current) {
          videoRef.current
            .play()
            .then(() => {
              setIsPlaying(true)
              startTimeUpdateInterval()
            })
            .catch((err) => {
              console.error("Error resuming playback after seek:", err)
            })
        }
      }, 1000)
    }
  }

  // Set up manual time update interval for more responsive UI updates
  useEffect(() => {
    // Start or stop the interval based on play state
    if (isPlaying && !isSeeking) {
      startTimeUpdateInterval()
    } else {
      stopTimeUpdateInterval()
    }

    return () => {
      stopTimeUpdateInterval()
    }
  }, [isPlaying, isSeeking])

  // Handle video events
  useEffect(() => {
    const video = videoRef.current
    if (video) {
      // Set initial muted state
      video.muted = isMuted

      // Function to update time display
      const updateTime = () => {
        if (!isSeeking) {
          setCurrentTime(video.currentTime)
        }
      }

      // Function to update duration when metadata is loaded
      const updateDuration = () => {
        if (video.duration && !isNaN(video.duration)) {
          setDuration(video.duration)
        }
      }

      // Function to handle video ready state
      const handleVideoReady = () => {
        console.log("Video can play, readyState:", video.readyState)
        setVideoReady(true)
        hideLoadingWithDelay()
      }

      // Function to handle video playing
      const handleVideoPlaying = () => {
        console.log("Video is playing")
        setIsPlaying(true)
        hideLoadingWithDelay(100)

        // Ensure interval is running
        startTimeUpdateInterval()

        // Notify parent if in headless mode
        if (externallyControlled && window.parent && window.parent !== window) {
          try {
            window.parent.postMessage(
              {
                type: "PLAYBACK_STATE_CHANGE",
                isPlaying: true,
                currentTime: video.currentTime,
              },
              "*",
            )
          } catch (e) {
            console.error("Error sending play state to parent:", e)
          }
        }
      }

      // Function to handle video paused
      const handleVideoPaused = () => {
        console.log("Video is paused")
        setIsPlaying(false)

        // Stop interval
        stopTimeUpdateInterval()

        // Notify parent if in headless mode
        if (externallyControlled && window.parent && window.parent !== window) {
          try {
            window.parent.postMessage(
              {
                type: "PLAYBACK_STATE_CHANGE",
                isPlaying: false,
                currentTime: video.currentTime,
              },
              "*",
            )
          } catch (e) {
            console.error("Error sending pause state to parent:", e)
          }
        }
      }

      // Function to handle video waiting
      const handleVideoWaiting = () => {
        console.log("Video is waiting/buffering")
        setShowLoading(true)

        // Notify parent if in headless mode
        if (externallyControlled && window.parent && window.parent !== window) {
          try {
            window.parent.postMessage(
              {
                type: "BUFFERING_START",
              },
              "*",
            )
          } catch (e) {
            console.error("Error sending buffering state to parent:", e)
          }
        }
      }

      // Function to handle video seeking completed
      const handleVideoSeeked = () => {
        console.log("Video seeking completed")
        setIsSeeking(false)
        hideLoadingWithDelay(300)

        // Clear the seeking timeout
        if (seekingTimeoutRef.current) {
          clearTimeout(seekingTimeoutRef.current)
          seekingTimeoutRef.current = null
        }

        // Resume playback if it was playing before seeking
        if (wasPlayingBeforeSeek) {
          video
            .play()
            .then(() => {
              setIsPlaying(true)
              startTimeUpdateInterval()
            })
            .catch((err) => {
              console.error("Error resuming playback after seek:", err)
            })
        }

        // Notify parent if in headless mode
        if (externallyControlled && window.parent && window.parent !== window) {
          try {
            window.parent.postMessage(
              {
                type: "BUFFERING_END",
                currentTime: video.currentTime,
              },
              "*",
            )
          } catch (e) {
            console.error("Error sending buffering end state to parent:", e)
          }
        }
      }

      // Function to handle video errors
      const handleVideoError = (e: Event) => {
        console.error("Video error:", e)

        // Notify parent if in headless mode
        if (externallyControlled && window.parent && window.parent !== window) {
          try {
            window.parent.postMessage(
              {
                type: "ERROR",
                message: "Video playback error",
              },
              "*",
            )
          } catch (e) {
            console.error("Error sending error state to parent:", e)
          }
        }
      }

      // Add event listeners
      video.addEventListener("play", handleVideoPlaying)
      video.addEventListener("pause", handleVideoPaused)
      video.addEventListener("timeupdate", updateTime)
      video.addEventListener("loadedmetadata", updateDuration)
      video.addEventListener("durationchange", updateDuration)
      video.addEventListener("canplay", handleVideoReady)
      video.addEventListener("canplaythrough", handleVideoReady)
      video.addEventListener("waiting", handleVideoWaiting)
      video.addEventListener("seeked", handleVideoSeeked)
      video.addEventListener("stalled", handleVideoWaiting)
      video.addEventListener("suspend", handleVideoReady)
      video.addEventListener("error", handleVideoError)

      // Initial update if video is already loaded
      if (video.readyState >= 3) {
        console.log("Video already in ready state:", video.readyState)
        updateDuration()
        setVideoReady(true)
        hideLoadingWithDelay()
      }

      return () => {
        // Remove event listeners
        video.removeEventListener("play", handleVideoPlaying)
        video.removeEventListener("pause", handleVideoPaused)
        video.removeEventListener("timeupdate", updateTime)
        video.removeEventListener("loadedmetadata", updateDuration)
        video.removeEventListener("durationchange", updateDuration)
        video.removeEventListener("canplay", handleVideoReady)
        video.removeEventListener("canplaythrough", handleVideoReady)
        video.removeEventListener("waiting", handleVideoWaiting)
        video.removeEventListener("seeked", handleVideoSeeked)
        video.removeEventListener("stalled", handleVideoWaiting)
        video.removeEventListener("suspend", handleVideoReady)
        video.removeEventListener("error", handleVideoError)
      }
    }
  }, [isMuted, wasPlayingBeforeSeek, externallyControlled]) // Re-run if isMuted, wasPlayingBeforeSeek, or externallyControlled changes

  // Skip forward/backward
  const skipForward = () => {
    if (externallyControlled) {
      console.log("Skip controlled by parent, ignoring local skip")
      return
    }

    if (videoRef.current) {
      setWasPlayingBeforeSeek(isPlaying)
      setIsSeeking(true)
      videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 10)
    }
  }

  const skipBackward = () => {
    if (externallyControlled) {
      console.log("Skip controlled by parent, ignoring local skip")
      return
    }

    if (videoRef.current) {
      setWasPlayingBeforeSeek(isPlaying)
      setIsSeeking(true)
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10)
    }
  }

  // Recenter camera
  const recenterCamera = () => {
    if (typeof window !== "undefined" && (window as any).recenterCamera) {
      ;(window as any).recenterCamera()

      // Notify parent if in headless mode
      if (externallyControlled && window.parent && window.parent !== window) {
        try {
          window.parent.postMessage(
            {
              type: "RECENTERED",
            },
            "*",
          )
        } catch (e) {
          console.error("Error sending recenter notification to parent:", e)
        }
      }
    }
  }

  // Add this useEffect to ensure the video element is properly initialized
  useEffect(() => {
    // This ensures the video element is properly initialized when A-Frame is loaded
    if (isAFrameLoaded && videoRef.current) {
      // Force a metadata load to get duration
      videoRef.current.load()

      // Check if we already have duration data
      if (videoRef.current.duration && !isNaN(videoRef.current.duration)) {
        setDuration(videoRef.current.duration)
      }

      // Add a direct play event listener to hide loading
      const handleDirectPlay = () => {
        console.log("Direct play event detected")
        setIsPlaying(true)
        setVideoReady(true)
        hideLoadingWithDelay(100)

        // Ensure interval is running
        startTimeUpdateInterval()
      }

      videoRef.current.addEventListener("play", handleDirectPlay)

      return () => {
        if (videoRef.current) {
          videoRef.current.removeEventListener("play", handleDirectPlay)
        }
      }
    }
  }, [isAFrameLoaded])

  // Effect to hide loading when video is playing and ready
  useEffect(() => {
    if (isPlaying && videoReady) {
      console.log("Video is playing and ready, hiding loading")
      hideLoadingWithDelay(100)
    }
  }, [isPlaying, videoReady])

  // Enhanced message handling for external control
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // You can add origin validation here for security
      // if (event.origin !== "https://your-parent-domain.com") return;

      try {
        // Handle full player configuration
        if (event.data && event.data.type === "SET_PLAYER_CONFIG" && event.data.config) {
          console.log("Received player config via postMessage:", event.data.config)

          // Store the configuration
          setPlayerConfig(event.data.config)
          configReceivedRef.current = true

          // Update chapter and playlist names if available
          if (event.data.config.chapter) {
            if (event.data.config.chapter.trackName) {
              setChapterName(event.data.config.chapter.trackName)
            }

            if (event.data.config.chapter.trackOrder) {
              setPlaylistName(`Chapter ${event.data.config.chapter.trackOrder}`)
            }
          }

          // Update video source if video element exists
          if (videoRef.current && event.data.config.VIDEO_360_SOURCE) {
            updateVideoSource(event.data.config.VIDEO_360_SOURCE)
          }
        }

        // Handle simple video source update
        if (event.data && event.data.type === "SET_VIDEO_SOURCE" && event.data.url) {
          console.log("Received video source via postMessage:", event.data.url)

          // Update video source if video element exists
          if (videoRef.current) {
            updateVideoSource(event.data.url)
          }
        }

        // Handle playback commands when in headless mode
        if (externallyControlled && event.data && event.data.type === "PLAYBACK_COMMAND") {
          const { command, value } = event.data

          if (!videoRef.current) return

          switch (command) {
            case "play":
              console.log("External command: play")
              videoRef.current.play().catch((err) => console.error("Play error:", err))
              break

            case "pause":
              console.log("External command: pause")
              videoRef.current.pause()
              break

            case "seek":
              // value should be in seconds
              if (typeof value === "number" && !isNaN(value)) {
                console.log(`External command: seek to ${value}s`)
                setIsSeeking(true)
                videoRef.current.currentTime = value
                setCurrentTime(value)
              }
              break

            case "setVolume":
              // value should be 0-1
              if (typeof value === "number" && !isNaN(value)) {
                console.log(`External command: set volume to ${value}`)
                videoRef.current.volume = Math.max(0, Math.min(1, value))
                setIsMuted(value === 0)
              }
              break

            case "setPlaybackRate":
              // value should be playback rate (0.5, 1, 1.5, etc)
              if (typeof value === "number" && !isNaN(value)) {
                console.log(`External command: set playback rate to ${value}`)
                videoRef.current.playbackRate = value
              }
              break

            case "recenter":
              console.log("External command: recenter")
              recenterCamera()
              break
          }
        }

        // Handle sync command
        if (externallyControlled && event.data && event.data.type === "SYNC") {
          const { currentTime, isPlaying } = event.data

          if (!videoRef.current) return

          // Only seek if the difference is significant (more than 0.2 seconds)
          const timeDiff = Math.abs(videoRef.current.currentTime - currentTime)
          if (timeDiff > 0.2) {
            console.log(
              `Syncing video time: ${videoRef.current.currentTime.toFixed(2)}s -> ${currentTime.toFixed(2)}s (diff: ${timeDiff.toFixed(2)}s)`,
            )
            videoRef.current.currentTime = currentTime
            setCurrentTime(currentTime)
          }

          // Sync play state
          if (isPlaying && videoRef.current.paused) {
            console.log("Syncing play state: play")
            videoRef.current.play().catch((err) => console.error("Sync play error:", err))
          } else if (!isPlaying && !videoRef.current.paused) {
            console.log("Syncing play state: pause")
            videoRef.current.pause()
          }
        }

        // Handle request for current time
        if (event.data && event.data.type === "REQUEST_CURRENT_TIME") {
          if (videoRef.current && window.parent && window.parent !== window) {
            try {
              window.parent.postMessage(
                {
                  type: "CURRENT_TIME_RESPONSE",
                  currentTime: videoRef.current.currentTime,
                  duration: videoRef.current.duration,
                  buffered:
                    videoRef.current.buffered.length > 0
                      ? videoRef.current.buffered.end(videoRef.current.buffered.length - 1)
                      : 0,
                },
                "*",
              )
            } catch (e) {
              console.error("Error sending current time response:", e)
            }
          }
        }
      } catch (error) {
        console.error("Error processing message:", error)
      }
    }

    // Add event listener for messages
    window.addEventListener("message", handleMessage)

    // Send ready message to parent again after a short delay
    // This helps ensure the parent receives it even if it wasn't ready earlier
    const readyMessageTimeout = setTimeout(() => {
      if (typeof window !== "undefined" && window.parent && window.parent !== window) {
        try {
          console.log("Sending delayed PLAYER_READY message to parent")
          window.parent.postMessage(
            {
              type: "PLAYER_READY",
              capabilities: {
                recenter: true,
                fullscreen: false,
                mute: true,
              },
            },
            "*",
          )
        } catch (e) {
          console.log("Could not send delayed ready message to parent:", e)
        }
      }
    }, 2000)

    return () => {
      window.removeEventListener("message", handleMessage)
      clearTimeout(readyMessageTimeout)
    }
  }, [externallyControlled, isPlaying])

  // Add a new effect to send time updates to parent when in headless mode
  useEffect(() => {
    if (!externallyControlled || !isPlaying) return

    const timeUpdateInterval = setInterval(() => {
      if (videoRef.current && window.parent && window.parent !== window) {
        try {
          window.parent.postMessage(
            {
              type: "TIME_UPDATE",
              currentTime: videoRef.current.currentTime,
              duration: videoRef.current.duration,
              buffered:
                videoRef.current.buffered.length > 0
                  ? videoRef.current.buffered.end(videoRef.current.buffered.length - 1)
                  : 0,
            },
            "*",
          )
        } catch (e) {
          console.error("Error sending time update:", e)
        }
      }
    }, 250) // Send updates 4 times per second

    return () => clearInterval(timeUpdateInterval)
  }, [externallyControlled, isPlaying])

  return (
    <div className="w-full h-screen relative bg-black overflow-hidden">
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/aframe/1.4.2/aframe.min.js"
        onLoad={() => {
          setIsAFrameLoaded(true)

          // Register A-Frame component for camera recentering
          if (typeof window !== "undefined" && (window as any).AFRAME) {
            // Register the camera-recenter component
            ;(window as any).AFRAME.registerComponent("camera-recenter", {
              schema: {
                initialRotation: { type: "vec3", default: { x: 0, y: -90, z: 0 } },
              },

              init: function () {
                this.cameraEl = this.el
                this.initialRotation = { x: 0, y: 0, z: 0 }
                this.videosphere = document.getElementById("videosphere")
                this.originalVideosphereRotation = this.videosphere ? this.videosphere.getAttribute("rotation").y : -90

                // Device orientation tracking
                this.deviceOrientationOffset = { alpha: 0, beta: 0, gamma: 0 }
                this.lastDeviceOrientation = null
                this.hasDeviceOrientationData = false
                this.hasInteracted = false
                this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                  navigator.userAgent,
                )

                this.el.sceneEl.addEventListener("loaded", () => {
                  this.initialRotation = Object.assign({}, this.cameraEl.getAttribute("rotation"))
                  console.log("Initial camera rotation stored:", this.initialRotation)

                  const cameraEntity = document.getElementById("cameraEntity")
                  if (cameraEntity && !cameraEntity.hasAttribute("camera-recenter")) {
                    cameraEntity.setAttribute("camera-recenter", "")
                  }

                  // Start device orientation tracking after scene is loaded
                  if (this.isMobile) {
                    this.setupDeviceOrientationTracking()
                  }
                })

                // Make recenter function available globally
                window.recenterCamera = this.recenter.bind(this)

                // Track user interaction
                this.el.sceneEl.addEventListener("touchstart", () => {
                  this.hasInteracted = true
                })

                console.log("Camera recenter component initialized")
              },

              setupDeviceOrientationTracking: function () {
                // Check if device orientation is available and set up tracking
                if (typeof window !== "undefined" && window.DeviceOrientationEvent) {
                  console.log("Setting up device orientation tracking")

                  // Store the handler so we can remove it later if needed
                  this.deviceOrientationHandler = this.handleDeviceOrientation.bind(this)

                  // Add the event listener
                  window.addEventListener("deviceorientation", this.deviceOrientationHandler)
                } else {
                  console.log("DeviceOrientationEvent not supported")
                }
              },

              handleDeviceOrientation: function (event) {
                // Store the last device orientation
                this.lastDeviceOrientation = {
                  alpha: event.alpha || 0,
                  beta: event.beta || 0,
                  gamma: event.gamma || 0,
                }

                // Mark that we have device orientation data
                if (event.alpha !== null && event.alpha !== undefined) {
                  this.hasDeviceOrientationData = true
                }
              },

              resetDesktopView: function () {
                const camera = this.cameraEl
                const lookControls = camera.components["look-controls"]

                if (lookControls) {
                  // Reset pitch and yaw objects
                  if (lookControls.pitchObject && lookControls.yawObject) {
                    lookControls.pitchObject.rotation.x = 0
                    lookControls.yawObject.rotation.y = 0
                    console.log("Desktop: Reset yawObject and pitchObject rotation to 0")
                  }

                  // Reset rotation
                  if (lookControls.rotation) {
                    lookControls.rotation.x = 0
                    lookControls.rotation.y = 0
                  }

                  // Reset camera rotation
                  camera.setAttribute("rotation", { x: 0, y: 0, z: 0 })
                  console.log("Desktop camera view reset")
                  return true
                }
              },

              resetMobileView: function () {
                console.log("Attempting mobile view reset")
                const camera = this.cameraEl
                const lookControls = camera.components["look-controls"]

                // Log current state for debugging
                console.log("Device orientation data available:", this.hasDeviceOrientationData)
                console.log("Last device orientation:", this.lastDeviceOrientation)

                try {
                  // APPROACH 1: Reset device orientation offset if available
                  if (this.lastDeviceOrientation && lookControls.hasOwnProperty("deviceOrientationMagicWindowDelta")) {
                    console.log("Using device orientation offset approach")

                    // Store the current device orientation as the new offset
                    this.deviceOrientationOffset = {
                      alpha: this.lastDeviceOrientation.alpha,
                      beta: this.lastDeviceOrientation.beta,
                      gamma: this.lastDeviceOrientation.gamma,
                    }

                    // Try to update the magic window delta
                    if (lookControls.deviceOrientationMagicWindowDelta) {
                      lookControls.deviceOrientationMagicWindowDelta.x = 0
                      lookControls.deviceOrientationMagicWindowDelta.y = 0
                      lookControls.deviceOrientationMagicWindowDelta.z = 0
                      console.log("Reset deviceOrientationMagicWindowDelta")
                    }
                  }

                  // APPROACH 2: Completely remove and re-add look-controls
                  console.log("Using remove/re-add look-controls approach for mobile")

                  // Completely disable and detach look-controls temporarily
                  const oldLookControlsData = camera.getAttribute("look-controls")
                  camera.removeAttribute("look-controls")

                  // Force a tick to ensure the component is fully removed
                  setTimeout(() => {
                    // Set rotation directly (this will stick without look-controls)
                    camera.setAttribute("rotation", { x: 0, y: 0, z: 0 })

                    // Re-add look-controls with the new baseline
                    setTimeout(() => {
                      camera.setAttribute("look-controls", oldLookControlsData)
                      console.log("Look-controls re-attached with new baseline orientation")

                      // Force an update of the look-controls
                      if (
                        camera.components["look-controls"] &&
                        typeof camera.components["look-controls"].updateOrientation === "function"
                      ) {
                        camera.components["look-controls"].updateOrientation()
                      }
                    }, 100)
                  }, 100)

                  // APPROACH 3: Try to reset magicWindowOrientation if it exists
                  if (lookControls.magicWindowOrientation) {
                    console.log("Using magicWindowOrientation approach")
                    lookControls.magicWindowOrientation.x = 0
                    lookControls.magicWindowOrientation.y = 0
                    console.log("Reset magicWindowOrientation")
                  }

                  // APPROACH 4: Try to use the A-Frame scene directly
                  const scene = document.querySelector("a-scene")
                  if (scene && scene.hasLoaded) {
                    console.log("Using A-Frame scene camera approach")
                    const threeCamera = scene.camera
                    if (threeCamera) {
                      // Create a new quaternion for centered view
                      const THREE = (window as any).THREE
                      if (THREE) {
                        const newQuaternion = new THREE.Quaternion()
                        newQuaternion.setFromEuler(
                          new THREE.Euler(
                            0, // Reset pitch (x) to 0
                            0, // Reset yaw (y) to 0
                            0,
                            "YXZ",
                          ),
                        )

                        // Apply the new quaternion
                        threeCamera.quaternion.copy(newQuaternion)
                        console.log("Reset camera quaternion directly to center")
                      }
                    }
                  }

                  return true
                } catch (e) {
                  console.error("Error in mobile view reset:", e)
                  // Fall back to desktop reset if mobile reset fails
                  return this.resetDesktopView()
                }
              },

              recenter: function () {
                try {
                  console.log("Recenter camera function called")

                  // Determine if we're on mobile
                  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                    navigator.userAgent,
                  )

                  // Use appropriate reset method
                  const success = isMobile ? this.resetMobileView() : this.resetDesktopView()

                  if (success) {
                    this.showRecenterFeedback()
                  }

                  return success
                } catch (e) {
                  console.error("Error in camera recenter:", e)
                  return false
                }
              },

              showRecenterFeedback: () => {
                const existingFeedback = document.getElementById("recenterFeedback")
                if (existingFeedback) {
                  document.body.removeChild(existingFeedback)
                }

                const feedback = document.createElement("div")
                feedback.id = "recenterFeedback"
                feedback.style.position = "fixed"
                feedback.style.top = "30%" // Position at top 30% instead of center to avoid loading indicator
                feedback.style.left = "50%"
                feedback.style.transform = "translate(-50%, -50%)"
                feedback.style.background = "rgba(0, 0, 0, 0.8)" // Match loading indicator style
                feedback.style.color = "white"
                feedback.style.padding = "12px 20px"
                feedback.style.borderRadius = "8px"
                feedback.style.fontSize = "14px"
                feedback.style.fontWeight = "500"
                feedback.style.zIndex = "2000" // Same z-index as loading indicator
                feedback.style.boxShadow = "0 2px 10px rgba(0,0,0,0.3)"
                feedback.style.backdropFilter = "blur(4px)"

                // Add a small icon and text like the loading indicator
                feedback.innerHTML = `
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span>View Recentered</span>
                    <i class="fas fa-compass" style="font-size: 14px;"></i>
                  </div>
                `

                document.body.appendChild(feedback)

                setTimeout(() => {
                  if (feedback.parentNode) {
                    feedback.style.opacity = "0"
                    feedback.style.transition = "opacity 0.5s ease"
                    setTimeout(() => {
                      if (feedback.parentNode) {
                        feedback.parentNode.removeChild(feedback)
                      }
                    }, 500)
                  }
                }, 1000)
              },
            })

            // Define global recenterCamera function separately
            ;(window as any).recenterCamera = () => {
              console.log("Global recenterCamera function called")

              // Try to find the camera entity with the camera-recenter component
              const cameraEl = document.querySelector("#cameraEntity")

              if (cameraEl) {
                console.log("Found camera entity, attempting to recenter")

                // Try multiple methods to ensure one works

                // Method 1: Use the component's recenter method directly
                if (cameraEl.components && cameraEl.components["camera-recenter"]) {
                  console.log("Directly calling component recenter method")
                  cameraEl.components["camera-recenter"].recenter()
                }

                // Method 2: Dispatch an event to the camera entity
                console.log("Dispatching recenter event to camera")
                cameraEl.dispatchEvent(new CustomEvent("recenter"))

                return true
              } else {
                console.error("Camera entity not found for recentering")
                return false
              }
            }
          }
        }}
      />

      {showLoading && <LoadingMessage message="Loading video..." />}

      {/* Only show one overlay at a time, with permission taking precedence */}
      {showPermission && <PermissionOverlay onEnable={requestDeviceOrientationPermission} />}
      {!showPermission && showTapToPlay && videoReady && !showLoading && (
        <TapToPlayOverlay onTap={handleFirstInteraction} />
      )}

      <div id="videoPlayerContainer" className="w-full h-screen relative">
        {isAFrameLoaded && (
          <div className="w-full h-full">
            <a-scene
              ref={sceneRef}
              loading-screen="dotsColor: white; backgroundColor: black"
              vr-mode-ui="enabled: false"
              device-orientation-permission-ui="enabled: false"
              embedded
              renderer="antialias: true; colorManagement: true; physicallyCorrectLights: true"
              device-orientation-controls="enabled: true"
              touch-controls="enabled: true"
              look-controls="reverseMouseDrag: true; touchEnabled: true; magicWindowTrackingEnabled: true"
              onLoaded={() => {
                console.log("A-Frame scene loaded")
                // Hide loading after scene is loaded
                setTimeout(() => setShowLoading(false), 1000)
              }}
            >
              <a-assets timeout="30000">
                <video
                  id="video360"
                  ref={videoRef}
                  crossOrigin="anonymous"
                  preload="auto"
                  muted={isMuted}
                  playsInline
                  webkit-playsinline="true"
                  onLoadedMetadata={() => {
                    console.log("Video metadata loaded")
                    if (videoRef.current && videoRef.current.duration) {
                      setDuration(videoRef.current.duration)
                    }
                  }}
                  onCanPlay={() => {
                    console.log("Video can play")
                    setVideoReady(true)
                    hideLoadingWithDelay()
                  }}
                  onPlaying={() => {
                    console.log("Video is playing")
                    setIsPlaying(true)
                    setVideoReady(true)
                    hideLoadingWithDelay(100)

                    // Ensure interval is running
                    startTimeUpdateInterval()
                  }}
                  onPause={() => {
                    console.log("Video paused")
                    setIsPlaying(false)

                    // Stop interval
                    stopTimeUpdateInterval()
                  }}
                >
                  <source id="videoSource" src={getVideoSource()} type="video/mp4" />
                </video>
              </a-assets>

              <a-videosphere id="videosphere" src="#video360" rotation="0 -90 0"></a-videosphere>
              <a-entity
                id="cameraEntity"
                camera
                look-controls="reverseMouseDrag: true; touchEnabled: true;"
                camera-recenter
                position="0 1.6 0"
              ></a-entity>
            </a-scene>
          </div>
        )}

        {/* Always show recenter button */}
        <RecenterButton onRecenter={recenterCamera} showTapToPlay={showTapToPlay} />
      </div>

      {/* Only show controls if not in headless mode */}
      {!headless && (
        <PlayerControls
          isPlaying={isPlaying}
          isMuted={isMuted}
          currentTime={currentTime}
          duration={duration}
          onPlayPause={togglePlayPause}
          onMute={toggleMute}
          onSeek={handleSeek}
          onSkipForward={skipForward}
          onSkipBackward={skipBackward}
          onRecenter={recenterCamera}
          sceneName={chapterName}
          playlistName={playlistName}
        />
      )}

      {/* Show dev toggle if in development mode */}
      {showDevToggle && <DevToggle onToggle={handleDevToggle} />}
    </div>
  )
}
