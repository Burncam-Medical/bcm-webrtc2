# Test Repo for web-rtc

## Goals
1. Enable multiple users to communicate with audio/video in a single, webRTC conference room
1. Support mobile (android/iOS)
1. Support modern web browsers (everything except I.E., basically)

## Current Implementation
- Codebase is react native
- Front end code is based off [ant media react native SDK](https://antmedia.io/docs/guides/developer-sdk-and-api/sdk-integration/react-native-sdk/) with associated [github](https://github.com/ant-media/WebRTC-React-Native-SDK)) 
    - Specifically, using the [conference](https://github.com/ant-media/WebRTC-React-Native-SDK/tree/main/samples/conference) example
    - Have disabled [InCallManager](https://github.com/react-native-webrtc/react-native-incall-manager) for the moment for simplicity
    - Have modified AntMediaLibrary functions to be partially compatible with [react-native-webrtc-web-shim](https://github.com/ruddell/react-native-webrtc-web-shim) 
- Using public [Ant Media Server](https://test.antmedia.io:5443/WebRTCAppEE/conference.html) for signalling while testing
- Using google STUN server for testing. No TURN server attached at this time

## Steps to Recreate Issue
- Clone repo
- Run `npm i --force` to override the react-native-webrtc-web-shim react version dependency conflict
- Build web version with `npm run web` or `npx expo start --web`
- (optional) build android version with `npm run android` or `npx expo run:android`
- Click "Join Room" in UI to initiate connection to hardcoded room
- Use other browser to open [Ant Media Server Conference Room](https://test.antmedia.io:5443/WebRTCAppEE/conference.html)
- Enter unique room name (currently hardcoded in /Video.jsx as 'bcmTest10001'
    - Note that audio track is muted to prevent feedback loops
- Observe that the video from the localhost is viewable from the Ant Media Server Conference Room website (or on android if running), BUT the remote video(s) are blank in the local host
    - The "remoteStreams" will show up as blank red squares and, periodically disappear/refresh 

## Suspected Issue
- My guess is that I haven't properly implemented the react-native-webrtc-web-shim or there is a base incompatability with my approach of trying to use one react-native code base for mobile and web video conferencing. I've tried a few versions to implement the web-shim [Track Listener](https://github.com/ruddell/react-native-webrtc-web-shim#track-listener) as per the repos instructions but without success