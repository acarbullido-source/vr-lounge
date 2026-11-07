import { useCallback, useEffect, useRef, useState } from 'react'
import type { ParticipantProfile, WebRTCSignalMessage } from '../types/lounge'

interface PeerEntry {
  userId: string
  pc: RTCPeerConnection
  isPolite: boolean
  makingOffer: boolean
  ignoreOffer: boolean
  isSettingRemoteAnswerPending: boolean
  pendingCandidates: RTCIceCandidateInit[]
  voiceSender: RTCRtpSender | null
  screenSenders: RTCRtpSender[]
  keepAliveChannel?: RTCDataChannel
}

function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ]

  const turnUrl = (import.meta.env.VITE_TURN_URL as string | undefined)?.trim()
  const turnUsername = (import.meta.env.VITE_TURN_USERNAME as string | undefined)?.trim()
  const turnCredential = (import.meta.env.VITE_TURN_CREDENTIAL as string | undefined)?.trim()

  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      ...(turnUsername ? { username: turnUsername } : {}),
      ...(turnCredential ? { credential: turnCredential } : {}),
    })
  }
  return servers
}

export interface UseWebRTCOptions {
  joined: boolean
  inVRSession: boolean
  localUserId: string
  participants: ParticipantProfile[]
  activePresenterId: string | null
  isMuted: boolean
  selectedMicId: string
  sendSignal: (signal: WebRTCSignalMessage) => void
  onScreenShareEndedByBrowser?: () => void
}

export function useWebRTC({
  joined,
  inVRSession,
  localUserId,
  participants,
  activePresenterId,
  isMuted,
  selectedMicId,
  sendSignal,
  onScreenShareEndedByBrowser,
}: UseWebRTCOptions) {
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([])
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([])
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null)
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null)
  const [remoteVoiceStreams, setRemoteVoiceStreams] = useState<Record<string, MediaStream>>({})
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Record<string, MediaStream>>({})
  const [localMicLevel, setLocalMicLevel] = useState(0)

  const peersRef = useRef<Map<string, PeerEntry>>(new Map())
  const localVoiceContainerRef = useRef<MediaStream | null>(null)
  const localMicTrackRef = useRef<MediaStreamTrack | null>(null)
  const localScreenStreamRef = useRef<MediaStream | null>(null)
  const sendSignalRef = useRef(sendSignal)
  const onEndedCallbackRef = useRef(onScreenShareEndedByBrowser)

  useEffect(() => {
    sendSignalRef.current = sendSignal
  }, [sendSignal])

  useEffect(() => {
    onEndedCallbackRef.current = onScreenShareEndedByBrowser
  }, [onScreenShareEndedByBrowser])

  const refreshDevices = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return
    }
    try {
      const list = await navigator.mediaDevices.enumerateDevices()
      setAudioInputs(list.filter((d) => d.kind === 'audioinput'))
      setAudioOutputs(list.filter((d) => d.kind === 'audiooutput'))
    } catch {
      // Ignore enumeration errors before permission grant
    }
  }, [])

  useEffect(() => {
    void refreshDevices()
    const mediaDevices = navigator.mediaDevices
    if (!mediaDevices?.addEventListener) return
    const handleChange = () => void refreshDevices()
    mediaDevices.addEventListener('devicechange', handleChange)
    return () => mediaDevices.removeEventListener('devicechange', handleChange)
  }, [refreshDevices])

  // Acquire & switch microphone track
  const acquireMicrophone = useCallback(
    async (deviceId?: string) => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setMicPermissionError('Browser requires HTTPS or localhost for microphone access.')
        return null
      }

      try {
        const constraints: MediaStreamConstraints = {
          audio: {
            ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        }
        const rawStream = await navigator.mediaDevices.getUserMedia(constraints)
        const newTrack = rawStream.getAudioTracks()[0] ?? null
        if (!newTrack) return null

        newTrack.enabled = !isMuted

        if (!localVoiceContainerRef.current) {
          localVoiceContainerRef.current = new MediaStream()
        }

        const prevTrack = localMicTrackRef.current
        if (prevTrack && prevTrack !== newTrack) {
          localVoiceContainerRef.current.removeTrack(prevTrack)
          prevTrack.stop()
        }

        localVoiceContainerRef.current.addTrack(newTrack)
        localMicTrackRef.current = newTrack
        setMicPermissionError(null)
        void refreshDevices()

        // Replace or attach voice track across active peers
        for (const entry of peersRef.current.values()) {
          if (entry.voiceSender) {
            await entry.voiceSender.replaceTrack(newTrack).catch(() => undefined)
          } else if (entry.pc.signalingState !== 'closed') {
            entry.voiceSender = entry.pc.addTrack(newTrack, localVoiceContainerRef.current)
          }
        }

        return newTrack
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Microphone permission denied or unavailable'
        setMicPermissionError(msg)
        return null
      }
    },
    [isMuted, refreshDevices],
  )

  // Toggle mute instantaneously on existing track
  useEffect(() => {
    if (localMicTrackRef.current) {
      localMicTrackRef.current.enabled = !isMuted
    }
  }, [isMuted])

  // Acquire mic when joining or switching selectedMicId (defer slightly during VR entry
  // so a 2D browser mic permission modal never interrupts Meta Quest Browser's XR transition)
  useEffect(() => {
    if (!joined || isMuted) return
    const delayMs = inVRSession ? 1800 : 80
    const timer = window.setTimeout(() => {
      void acquireMicrophone(selectedMicId || undefined)
    }, delayMs)
    return () => window.clearTimeout(timer)
  }, [acquireMicrophone, inVRSession, isMuted, joined, selectedMicId])

  // Local microphone VU / speaking ring analyser
  useEffect(() => {
    const track = localMicTrackRef.current
    if (!joined || !track || isMuted) {
      setLocalMicLevel(0)
      return
    }

    let audioCtx: AudioContext | null = null
    let timer: number | null = null

    try {
      audioCtx = new AudioContext()
      const stream = new MediaStream([track])
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      analyser.smoothingTimeConstant = 0.65
      source.connect(analyser)
      const bins = new Uint8Array(analyser.frequencyBinCount)

      timer = window.setInterval(() => {
        if (!track.enabled) {
          setLocalMicLevel(0)
          return
        }
        analyser.getByteFrequencyData(bins)
        let sum = 0
        for (let i = 0; i < bins.length; i++) {
          sum += bins[i]
        }
        const normalized = Math.min(1, sum / (bins.length * 95))
        setLocalMicLevel((prev) => (Math.abs(prev - normalized) > 0.03 ? normalized : prev))
      }, 90)
    } catch {
      // Ignore Web Audio init errors before gesture
    }

    return () => {
      if (timer !== null) window.clearInterval(timer)
      if (audioCtx) void audioCtx.close().catch(() => undefined)
    }
  }, [joined, isMuted, selectedMicId, audioInputs.length])

  const closePeer = useCallback((remoteUserId: string) => {
    const entry = peersRef.current.get(remoteUserId)
    if (entry) {
      entry.pc.onnegotiationneeded = null
      entry.pc.onicecandidate = null
      entry.pc.ontrack = null
      entry.pc.close()
      peersRef.current.delete(remoteUserId)
    }
    setRemoteVoiceStreams((prev) => {
      if (!(remoteUserId in prev)) return prev
      const next = { ...prev }
      delete next[remoteUserId]
      return next
    })
    setRemoteScreenStreams((prev) => {
      if (!(remoteUserId in prev)) return prev
      const next = { ...prev }
      delete next[remoteUserId]
      return next
    })
  }, [])

  const getOrCreatePeer = useCallback(
    (remoteUserId: string): PeerEntry => {
      const existing = peersRef.current.get(remoteUserId)
      if (existing && existing.pc.connectionState !== 'closed') {
        return existing
      }

      const pc = new RTCPeerConnection({
        iceServers: buildIceServers(),
      })
      const isPolite = localUserId < remoteUserId

      const entry: PeerEntry = {
        userId: remoteUserId,
        pc,
        isPolite,
        makingOffer: false,
        ignoreOffer: false,
        isSettingRemoteAnswerPending: false,
        pendingCandidates: [],
        voiceSender: null,
        screenSenders: [],
      }

      // Attach local mic track if ready
      if (localMicTrackRef.current && localVoiceContainerRef.current) {
        entry.voiceSender = pc.addTrack(
          localMicTrackRef.current,
          localVoiceContainerRef.current,
        )
      }

      // Attach local presenter tab stream if currently sharing
      if (localScreenStreamRef.current) {
        const screenStream = localScreenStreamRef.current
        for (const track of screenStream.getTracks()) {
          entry.screenSenders.push(pc.addTrack(track, screenStream))
        }
      }

      // Impolite peer creates a lightweight data channel so negotiation always starts
      // even if a spectator joins without a microphone
      if (!isPolite) {
        entry.keepAliveChannel = pc.createDataChannel('vr-lounge-sync', {
          ordered: false,
        })
      }

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          sendSignalRef.current({
            kind: 'webrtc-ice',
            fromUserId: localUserId,
            toUserId: remoteUserId,
            candidate: ev.candidate.toJSON(),
            timestamp: Date.now(),
          })
        }
      }

      pc.onnegotiationneeded = async () => {
        try {
          entry.makingOffer = true
          await pc.setLocalDescription()
          if (pc.localDescription) {
            sendSignalRef.current({
              kind: 'webrtc-offer',
              fromUserId: localUserId,
              toUserId: remoteUserId,
              sdp: {
                type: pc.localDescription.type,
                sdp: pc.localDescription.sdp,
              },
              timestamp: Date.now(),
            })
          }
        } catch {
          // Glare or transient state handled by perfect negotiation
        } finally {
          entry.makingOffer = false
        }
      }

      pc.ontrack = (ev) => {
        const stream = ev.streams[0] ?? new MediaStream([ev.track])
        const isScreenStream =
          ev.track.kind === 'video' || stream.getVideoTracks().length > 0

        if (isScreenStream) {
          setRemoteScreenStreams((prev) => ({
            ...prev,
            [remoteUserId]: stream,
          }))

          const cleanupIfEnded = () => {
            const activeTracks = stream
              .getTracks()
              .filter((t) => t.readyState === 'live')
            if (activeTracks.length === 0) {
              setRemoteScreenStreams((prev) => {
                if (prev[remoteUserId] !== stream) return prev
                const next = { ...prev }
                delete next[remoteUserId]
                return next
              })
            }
          }
          ev.track.addEventListener('ended', cleanupIfEnded)
          stream.addEventListener('removetrack', cleanupIfEnded)
        } else {
          setRemoteVoiceStreams((prev) => ({
            ...prev,
            [remoteUserId]: stream,
          }))
        }
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          pc.restartIce()
        }
      }

      peersRef.current.set(remoteUserId, entry)
      return entry
    },
    [localUserId],
  )

  // Reconcile peer connections whenever participant roster changes
  useEffect(() => {
    if (!joined) {
      for (const peerId of Array.from(peersRef.current.keys())) {
        closePeer(peerId)
      }
      return
    }

    const remoteIds = new Set(
      participants.filter((p) => p.userId !== localUserId).map((p) => p.userId),
    )

    for (const remoteId of remoteIds) {
      getOrCreatePeer(remoteId)
    }

    for (const existingId of Array.from(peersRef.current.keys())) {
      if (!remoteIds.has(existingId)) {
        closePeer(existingId)
      }
    }
  }, [closePeer, getOrCreatePeer, joined, localUserId, participants])

  // Incoming WebRTC SDP & ICE signal handler (Perfect Negotiation)
  const handleWebRTCSignal = useCallback(
    async (signal: WebRTCSignalMessage) => {
      if (!joined || signal.toUserId !== localUserId) return
      const entry = getOrCreatePeer(signal.fromUserId)
      const { pc } = entry

      try {
        if (signal.kind === 'webrtc-offer' && signal.sdp) {
          const readyForOffer =
            !entry.makingOffer &&
            (pc.signalingState === 'stable' || entry.isSettingRemoteAnswerPending)
          const offerCollision = !readyForOffer

          entry.ignoreOffer = !entry.isPolite && offerCollision
          if (entry.ignoreOffer) return

          await pc.setRemoteDescription(signal.sdp)
          while (entry.pendingCandidates.length > 0) {
            const candidate = entry.pendingCandidates.shift()
            if (candidate) {
              await pc.addIceCandidate(candidate).catch(() => undefined)
            }
          }

          await pc.setLocalDescription()
          if (pc.localDescription) {
            sendSignalRef.current({
              kind: 'webrtc-answer',
              fromUserId: localUserId,
              toUserId: signal.fromUserId,
              sdp: {
                type: pc.localDescription.type,
                sdp: pc.localDescription.sdp,
              },
              timestamp: Date.now(),
            })
          }
        } else if (signal.kind === 'webrtc-answer' && signal.sdp) {
          entry.isSettingRemoteAnswerPending = true
          try {
            await pc.setRemoteDescription(signal.sdp)
          } finally {
            entry.isSettingRemoteAnswerPending = false
          }
          while (entry.pendingCandidates.length > 0) {
            const candidate = entry.pendingCandidates.shift()
            if (candidate) {
              await pc.addIceCandidate(candidate).catch(() => undefined)
            }
          }
        } else if (signal.kind === 'webrtc-ice' && signal.candidate) {
          if (!pc.remoteDescription) {
            entry.pendingCandidates.push(signal.candidate)
          } else {
            try {
              await pc.addIceCandidate(signal.candidate)
            } catch (err) {
              if (!entry.ignoreOffer) {
                console.warn('ICE candidate warning:', err)
              }
            }
          }
        }
      } catch (err) {
        console.warn('WebRTC signaling recovery:', err)
      }
    },
    [getOrCreatePeer, joined, localUserId],
  )

  const stopTabShare = useCallback(() => {
    const activeStream = localScreenStreamRef.current
    if (!activeStream) return

    for (const entry of peersRef.current.values()) {
      for (const sender of entry.screenSenders) {
        if (entry.pc.signalingState !== 'closed') {
          try {
            entry.pc.removeTrack(sender)
          } catch {
            // Ignore closed sender
          }
        }
      }
      entry.screenSenders = []
    }

    for (const track of activeStream.getTracks()) {
      track.onended = null
      track.stop()
    }

    localScreenStreamRef.current = null
    setLocalScreenStream(null)
  }, [])

  // Automatically release getDisplayMedia if another participant claims Presenter Control
  useEffect(() => {
    if (localScreenStreamRef.current && activePresenterId !== localUserId) {
      stopTabShare()
    }
  }, [activePresenterId, localUserId, stopTabShare])

  const startTabShare = useCallback(async (): Promise<{
    ok: boolean
    title?: string
    error?: string
  }> => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getDisplayMedia !== 'function'
    ) {
      return {
        ok: false,
        error:
          'Live Browser Tab Capture requires a desktop browser (Chrome/Edge/Brave). From a VR headset, use Mode 2 Synchronized URL Player or pair a Desktop Presenter tab.',
      }
    }

    try {
      stopTabShare()

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30, max: 30 },
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

      const videoTrack = displayStream.getVideoTracks()[0]
      if (!videoTrack) {
        for (const t of displayStream.getTracks()) t.stop()
        return { ok: false, error: 'No video track returned from screen capture.' }
      }

      if ('contentHint' in videoTrack) {
        videoTrack.contentHint = 'motion'
      }

      videoTrack.onended = () => {
        stopTabShare()
        onEndedCallbackRef.current?.()
      }

      localScreenStreamRef.current = displayStream
      setLocalScreenStream(displayStream)

      for (const entry of peersRef.current.values()) {
        for (const oldSender of entry.screenSenders) {
          try {
            entry.pc.removeTrack(oldSender)
          } catch {
            // Ignore
          }
        }
        entry.screenSenders = []
        if (entry.pc.signalingState !== 'closed') {
          for (const track of displayStream.getTracks()) {
            entry.screenSenders.push(entry.pc.addTrack(track, displayStream))
          }
        }
      }

      const label = videoTrack.label?.trim() || 'Live Browser Tab'
      return { ok: true, title: label }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Screen capture was cancelled or denied.'
      return { ok: false, error: msg }
    }
  }, [stopTabShare])

  // Clean up everything on unmount
  useEffect(() => {
    const peersMap = peersRef.current
    return () => {
      stopTabShare()
      if (localMicTrackRef.current) {
        localMicTrackRef.current.stop()
        localMicTrackRef.current = null
      }
      for (const entry of peersMap.values()) {
        entry.pc.close()
      }
      peersMap.clear()
    }
  }, [stopTabShare])

  return {
    audioInputs,
    audioOutputs,
    micPermissionError,
    localMicLevel,
    localScreenStream,
    remoteVoiceStreams,
    remoteScreenStreams,
    acquireMicrophone,
    refreshDevices,
    handleWebRTCSignal,
    startTabShare,
    stopTabShare,
  }
}
