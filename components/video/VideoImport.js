import React from 'react';
import {
	RTCPeerConnection as webRTCPeerConnection,
	RTCIceCandidate as webRTCIceCandidate,
	RTCSessionDescription as webRTCSessionDescription,
	RTCView as WebRTCView,
	mediaDevices as webMediaDevices,
} from 'react-native-webrtc-web-shim';
import 'webrtc-adapter';

export const RTCView = (props) => {

	// console.log(props.stream);
	return (
		<WebRTCView
			stream={props.stream}
			objectFit="contain"
			style={props.style}
		/>
	);
};

export const RTCPeerConnection = webRTCPeerConnection;
export const RTCIceCandidate = webRTCIceCandidate;
export const RTCSessionDescription = webRTCSessionDescription;
export const mediaDevices = webMediaDevices;