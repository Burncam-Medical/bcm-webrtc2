import React from 'react';
import {
	RTCPeerConnection as mobileRTCPeerConnection,
	RTCIceCandidate as mobileRTCIceCandidate,
	RTCSessionDescription as mobileRTCSessionDescription,
	RTCView as MobileRTCView,
	mediaDevices as mobileMediaDevices,
	registerGlobals,
} from 'react-native-webrtc';
registerGlobals();

export const RTCView = (props) => (
	<MobileRTCView
		streamURL={props.stream.toURL()}
		objectFit="contain"
		style={props.style}
	/>
);

export const RTCPeerConnection = mobileRTCPeerConnection;
export const RTCIceCandidate = mobileRTCIceCandidate;
export const RTCSessionDescription = mobileRTCSessionDescription;
export const mediaDevices = mobileMediaDevices;