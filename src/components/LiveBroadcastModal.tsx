import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Video, Mic, MicOff, VideoOff, XCircle, Loader2, SwitchCamera } from 'lucide-react';

interface LiveBroadcastModalProps {
  pairingCode: string;
  onClose: () => void;
}

export default function LiveBroadcastModal({ pairingCode, onClose }: LiveBroadcastModalProps) {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    // Setup signaling channel
    const channel = supabase.channel(`webrtc-${pairingCode}`);
    channelRef.current = channel;

    channel.on('broadcast', { event: 'signal' }, async (payload) => {
      try {
        const data = payload.payload;
        if (!data) return;
        
        const pc = peerConnectionRef.current;
        if (!pc) return;

        if (data.type === 'answer' && data.target === 'remote') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          setIsBroadcasting(true);
          setIsInitializing(false);
        } else if (data.type === 'candidate' && data.target === 'remote') {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (err) {
        console.error('WebRTC signaling error:', err);
      }
    }).subscribe();

    return () => {
      stopBroadcast();
      channel.unsubscribe();
    };
  }, [pairingCode]);

  const startBroadcast = async () => {
    setIsInitializing(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: true
      });
      
      streamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      peerConnectionRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate && channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'candidate', candidate: event.candidate, target: 'tv' }
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      channelRef.current?.send({
        type: 'broadcast',
        event: 'signal',
        payload: { type: 'offer', sdp: offer, target: 'tv' }
      });

    } catch (error) {
      console.error('Error starting broadcast:', error);
      alert('Não foi possível acessar a câmera/microfone. Verifique as permissões.');
      setIsInitializing(false);
    }
  };

  const stopBroadcast = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    channelRef.current?.send({
      type: 'broadcast',
      event: 'signal',
      payload: { type: 'stop', target: 'tv' }
    });
    setIsBroadcasting(false);
    setIsInitializing(false);
  };

  const toggleMute = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const switchCamera = async () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    if (isBroadcasting || isInitializing) {
      stopBroadcast();
      setTimeout(startBroadcast, 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="p-4 flex justify-between items-center border-b border-zinc-800">
          <h3 className="text-white font-bold flex items-center gap-2">
            <Video className="text-red-500" /> Transmissão ao Vivo
          </h3>
          <button onClick={() => { stopBroadcast(); onClose(); }} className="text-zinc-500 hover:text-white">
            <XCircle size={24} />
          </button>
        </div>
        
        <div className="relative aspect-[9/16] bg-black flex items-center justify-center">
          <video 
            ref={localVideoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          />
          
          {!isBroadcasting && !isInitializing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <button 
                onClick={startBroadcast}
                className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg shadow-red-600/20 flex items-center gap-3"
              >
                <Video size={24} /> Iniciar Transmissão
              </button>
            </div>
          )}

          {isInitializing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white">
              <Loader2 className="animate-spin mb-4" size={48} />
              <p className="font-bold">Conectando à TV...</p>
            </div>
          )}

          {isBroadcasting && (
            <div className="absolute top-4 right-4 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full"></div> AO VIVO
            </div>
          )}
        </div>

        <div className="p-6 bg-zinc-900 flex justify-center gap-6">
          <button 
            onClick={toggleMute}
            className={`p-4 rounded-full ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-zinc-800 text-white'}`}
          >
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
          
          <button 
            onClick={stopBroadcast}
            className="p-4 rounded-full bg-red-600 text-white shadow-lg shadow-red-600/20"
          >
            <VideoOff size={24} />
          </button>

          <button 
            onClick={switchCamera}
            className="p-4 rounded-full bg-zinc-800 text-white"
          >
            <SwitchCamera size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
