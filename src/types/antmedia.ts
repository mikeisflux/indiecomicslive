// Shared types for Ant Media's webrtc_adaptor.js, used by both
// AntMediaPlayer (play mode) and AntMediaPublisher (publish mode).
// Single declaration so the global Window augmentation lands in one
// place — TS rejects two separate `interface WebRtcAdaptorCtor`
// declarations both pointing at the same window property.

export interface WebRTCAdaptorCtor {
  new (config: {
    websocket_url: string;
    mediaConstraints?: MediaStreamConstraints;
    peerconnection_config?: RTCConfiguration;
    sdp_constraints?: {
      OfferToReceiveAudio: boolean;
      OfferToReceiveVideo: boolean;
    };
    remoteVideoId?: string;
    localVideoId?: string;
    isPlayMode?: boolean;
    debug?: boolean;
    callback: (info: string, obj?: unknown) => void;
    callbackError?: (info: string, obj?: unknown) => void;
  }): {
    play?: (streamId: string, token?: string) => void;
    publish?: (streamId: string, token?: string) => void;
    stop: (streamId: string) => void;
  };
}

declare global {
  interface Window {
    WebRTCAdaptor?: WebRTCAdaptorCtor;
  }
}
