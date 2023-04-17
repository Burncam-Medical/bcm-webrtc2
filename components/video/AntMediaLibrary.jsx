import React, {
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';

import {
	RTCPeerConnection,
	RTCIceCandidate,
	RTCSessionDescription,
	mediaDevices,
	RTCView,
} from './VideoImport';
import { Platform } from 'react-native';

//useAntMedia main adaptor function
export const useAntMedia = (params) => {
	const {
		url,
		mediaConstraints,
		callbackError,
		callback,
		peer_connection_config,
		debug,
		onlyDataChannel,
	} = params;

	// eslint-disable-next-line no-unused-vars
	const [roomName, setRoomName] = useState('');

	const adaptorRef = useRef(null);

	let localStream = useRef(null);
	const [remoteStreams, setRemoteStreams] = useState({});
	const [remoteStreamsMapped, setRemoteStreamsMapped] = useState({});

	const remotePeerConnection = useRef({}).current;
	const remotePeerConnectionStats = useRef({}).current;

	const remoteDescriptionSet = useRef({}).current;
	const iceCandidateList = useRef({}).current;

	const config = peer_connection_config;

	const playStreamIds = useRef([]).current;

	const closePeerConnection = useCallback(
		(streamId) => {
			if (debug) console.log('closePeerConnection');

			if (remotePeerConnection[streamId] != null) {

				if (remotePeerConnection[streamId].dataChannel != null)

					remotePeerConnection[streamId].dataChannel.close();

				setRemoteStreams((value) => {
					const val = { ...value };
					const streams = [...remotePeerConnection[streamId].getLocalStreams()];
					streams.forEach((stream) => {
						if (localStream.current !== stream) {
							delete val[stream];
						}
					});
					return val;
				});

				setRemoteStreamsMapped((value) => {
					const val = { ...value };
					const streams = [...remotePeerConnection[streamId].getLocalStreams()];
					streams.forEach((stream) => {
						if (localStream.current !== stream) {
							delete val[streamId];
						}
					});
					return val;
				});

				if (remotePeerConnection[streamId].signalingState !== 'closed') {
					remotePeerConnection[streamId].close();

					remotePeerConnection[streamId] = null;

					delete remotePeerConnection[streamId];
					const playStreamIndex = playStreamIds.indexOf(streamId);

					if (playStreamIndex !== -1) {
						playStreamIds.splice(playStreamIndex, 1);
					}
				}
			}

			if (remotePeerConnectionStats[streamId] != null) {
				clearInterval(remotePeerConnectionStats[streamId].timerId);
				delete remotePeerConnectionStats[streamId];
			}
		},
		[playStreamIds, remotePeerConnection, remotePeerConnectionStats]
	);

	const iceCandidateReceived = useCallback(
		(event, streamId) => {
			if (event.candidate) {
				const jsCmd = {
					command: 'takeCandidate',
					streamId,
					label: event.candidate.sdpMLineIndex,
					id: event.candidate.sdpMid,
					candidate: event.candidate.candidate,
				};

				if (ws) ws.sendJson(jsCmd);
			}
		},
		[ws]
	);

	const onTrack = useCallback(
		(event, streamId) => {
			if (!remoteStreams[streamId]) {
				setRemoteStreams((dt) => {
					dt[streamId] = event.streams[0];
					return dt;
				});
				const dataObj = {
					track: event.streams[0],
					streamId,
				};

				if (adaptorRef.current) {
					callback.call(adaptorRef.current, 'newStreamAvailable', dataObj);
				}
			}
		},
		[callback, remoteStreams]
	);

	const initDataChannel = useCallback((streamId, dataChannel) => {
		dataChannel.onerror = (error) => {
			console.log('Data Channel Error:', error);
			const obj = {
				streamId: streamId,
				error: error,
			};
			console.log('channel status: ', dataChannel.readyState);
			if (dataChannel.readyState !== 'closed' && callbackError) {
				callbackError('data_channel_error', obj);
			}
		};

		dataChannel.onmessage = (event) => {
			const obj = {
				streamId: streamId,
				event: event,
			};
			if (callback && adaptorRef.current)
				callback.call(adaptorRef.current, 'data_received', obj);
		};

		dataChannel.onopen = () => {

			remotePeerConnection[streamId].dataChannel = dataChannel;
			console.log('Data channel is opened');
			if (callback && adaptorRef.current)
				callback.call(adaptorRef.current, 'data_channel_opened', streamId);
		};

		dataChannel.onclose = () => {
			console.log('Data channel is closed');
			if (callback && adaptorRef.current)
				callback.call(adaptorRef.current, 'data_channel_closed', streamId);
		};
	}, []);

	const initPeerConnection = useCallback(
		async (streamId, dataChannelMode) => {
			if (debug) console.log('in initPeerConnection');

			if (remotePeerConnection[streamId] == null) {
				const closedStreamId = streamId;
				remotePeerConnection[streamId] = new RTCPeerConnection(
					config || {
						iceServers: [],
					}
				);
				remoteDescriptionSet[streamId] = false;
				iceCandidateList[streamId] = [];

				if (!playStreamIds.includes(streamId)) {
					if (localStream.current) {
						remotePeerConnection[streamId].addStream(localStream.current);
					}
				}

				try {
					remotePeerConnection[streamId].onicecandidate = (event) => {
						if (debug) console.log('onicecandidate', event);
						iceCandidateReceived(event, closedStreamId);
					};


					remotePeerConnection[streamId].ontrack = (event) => {
						if (debug) console.log('onTrack', event);
						onTrack(event, closedStreamId);
					};
					remotePeerConnection[streamId].onaddstream = (event) => {
						if (debug) console.log('onaddstream', event);
						setRemoteStreams((value) => {
							const val = { ...value };
							const streams = [
								...remotePeerConnection[streamId].getLocalStreams(),
								...remotePeerConnection[streamId].getRemoteStreams(),
							];
							streams.forEach((stream) => {
								if (localStream.current !== stream) {
									val[stream] = stream;
								}
							});
							return val;
						});

						//setRemoteStreamsMapped
						setRemoteStreamsMapped((value) => {
							const val = { ...value };
							const streams = [
								...remotePeerConnection[streamId].getLocalStreams(),
								...remotePeerConnection[streamId].getRemoteStreams(),
							];
							streams.forEach((stream) => {
								if (localStream.current !== stream) {
									val[streamId] = stream;
								}
							});
							return val;
						});
					};

					if (dataChannelMode === 'publish') {
						//open data channel if it's publish mode peer connection
						const dataChannelOptions = {
							ordered: true,
						};
						const dataChannelPeer = remotePeerConnection[
							streamId
						].createDataChannel(streamId, dataChannelOptions);
						initDataChannel(streamId, dataChannelPeer);
					} else if (dataChannelMode === 'play') {
						//in play mode, server opens the data channel
						// Property 'ondatachannel' does not exist on type 'RTCPeerConnection' react-native-webrtc
						remotePeerConnection[streamId].ondatachannel = (event) => {
							initDataChannel(streamId, event.channel);
						};
					} else {
						//for peer mode do both for now
						const dataChannelOptions = {
							ordered: true,
						};

						const dataChannelPeer = remotePeerConnection[
							streamId
						].createDataChannel(streamId, dataChannelOptions);
						initDataChannel(streamId, dataChannelPeer);


						remotePeerConnection[streamId].ondatachannel = (ev) => {
							initDataChannel(streamId, ev.channel);
						};
					}
				} catch (err) {
					if (debug) console.error('initPeerConnectionError', err.message);
				}
			}
		},
		[
			config,
			debug,
			iceCandidateList,
			iceCandidateReceived,
			onTrack,
			playStreamIds,
			remoteDescriptionSet,
			remotePeerConnection,
		]
	);

	const gotDescription = useCallback(
		async (configuration, streamId) => {
			try {
				if (debug) console.log('in gotDescription');

				// const response =
				await remotePeerConnection[streamId].setLocalDescription(configuration);

				const jsCmd = {
					command: 'takeConfiguration',
					streamId,
					type: configuration.type,
					sdp: configuration.sdp,
				};

				if (ws) ws.sendJson(jsCmd);
			} catch (err) {
				if (debug) console.log('gotDescriptionError', err);
			}
		},
		[debug, remotePeerConnection, ws]
	);

	const startPublishing = useCallback(
		async (streamId) => {
			try {
				if (debug) console.log('in start publishing');

				await initPeerConnection(streamId, 'publish');
				const configuration = await remotePeerConnection[streamId].createOffer(
					config
				);
				await gotDescription(configuration, streamId);
			} catch (err) {
				if (debug) console.log('startPublishing error', err.message, err.stack);
			}
		},
		[config, debug, gotDescription, initPeerConnection, remotePeerConnection]
	);

	const addIceCandidate = useCallback(
		async (streamId, candidate) => {
			try {
				if (debug) console.log('in addIceCandidate');
				if (debug) console.debug(`addIceCandidate ${streamId}`);
				if (debug) console.debug('candidate', candidate);
				await remotePeerConnection[streamId].addIceCandidate(candidate);
			} catch (err) {
				console.log('Add Ice Candidate error', err);
			}
		},
		[debug, remotePeerConnection]
	);

	const takeConfiguration = useCallback(
		async (idOfStream, configuration, typeOfConfiguration) => {
			const streamId = idOfStream;
			const type = typeOfConfiguration;
			const conf = configuration;
			const isTypeOffer = type === 'offer';

			if (debug) console.log('in takeConfiguration');

			let dataChannelMode = 'publish';
			if (isTypeOffer) {
				dataChannelMode = 'play';
			}
			await initPeerConnection(streamId, dataChannelMode);
			try {
				await remotePeerConnection[streamId].setRemoteDescription(
					new RTCSessionDescription({
						sdp: conf,
						type,
					})
				);

				remoteDescriptionSet[streamId] = true;
				const { length } = Object.keys(iceCandidateList[streamId]);

				for (let i = 0; i < length; i++) {
					await addIceCandidate(streamId, iceCandidateList[streamId][i]);
				}
				iceCandidateList[streamId] = [];

				if (isTypeOffer) {
					const configur = await remotePeerConnection[streamId].createAnswer(
						conf
					);
					await gotDescription(configur, streamId);
				}
			} catch (error) {
				if (
					error.toString().indexOf('InvalidAccessError') > -1 ||
            error.toString().indexOf('setRemoteDescription') > -1
				) {
					/**
             * This error generally occurs in codec incompatibility.
             * AMS for a now supports H.264 codec. This error happens when some browsers try to open it from VP8.
             */
					if (callbackError) callbackError('notSetRemoteDescription');
				}
			}
		},
		[
			addIceCandidate,
			callbackError,
			debug,
			gotDescription,
			iceCandidateList,
			initPeerConnection,
			remoteDescriptionSet,
			remotePeerConnection,
		]
	);

	const takeCandidate = useCallback(
		async (idOfTheStream, tmpLabel, tmpCandidate, sdpMid) => {
			if (debug) console.log('in takeCandidate');

			const streamId = idOfTheStream;
			const label = tmpLabel;
			const candidateSdp = tmpCandidate;

			const candidate = new RTCIceCandidate({
				sdpMLineIndex: label,
				candidate: candidateSdp,
				sdpMid,
			});

			await initPeerConnection(streamId, 'peer');

			if (remoteDescriptionSet[streamId] === true) {
				await addIceCandidate(streamId, candidate);
			} else {
				if (debug)
					console.debug(
						'Ice candidate is added to list because remote description is not set yet'
					);
				const index = iceCandidateList[streamId].findIndex(
					(i) => JSON.stringify(i) === JSON.stringify(candidate)
				);
				if (index === -1) {
					const keys = Object.keys(candidate);
					for (const key in keys) {

						if (candidate[key] === undefined || candidate[key] === '') {

							candidate[key] = null;
						}
					}
					iceCandidateList[streamId].push(candidate);
				}
			}
		},
		[
			addIceCandidate,
			debug,
			iceCandidateList,
			initPeerConnection,
			remoteDescriptionSet,
		]
	);

	var ws = useRef(new WebSocket(url)).current;

	ws.sendJson = (dt) => {
		ws.send(JSON.stringify(dt));
	};

	useEffect(() => {
		ws.onopen = () => {
			if (debug) console.log('web socket opened !');

			// connection opened

			if (!onlyDataChannel) {
				mediaDevices
					.getUserMedia(mediaConstraints)
					.then((stream) => {
						// Got stream!
						if (debug) console.log('got stream');

						localStream.current = stream;

						if (debug) console.log('in stream', localStream.current);
					})
					.catch((error) => {
						// Log error
						if (debug) console.log('got error', error);
					});
			} else {
				if (debug) console.log('only data channel');
			}

			ws.sendJson({
				command: 'ping',
			});
		};

		ws.onmessage = (e) => {
			// a message was received
			const data = JSON.parse(e.data);
			if (debug) console.log(' onmessage', data);

			switch (data.command) {
				case 'start':
					// start  publishing
					startPublishing(data.streamId);
					break;
				case 'takeCandidate':
					//console.log(' in takeCandidate', data);
					takeCandidate(data.streamId, data.label, data.candidate, data.id);
					break;
				case 'takeConfiguration':
					takeConfiguration(data.streamId, data.sdp, data.type);
					break;
				case 'stop':
					if (debug) console.log(' in stop', data);
					closePeerConnection(data.streamId);
					break;
				case 'error':
					if (debug) console.log(' in error', data);
					if (callbackError) {
						callbackError(data.definition, data);
					}
					break;
				case 'notification':
					if (debug) console.log(' in notification', data);

					if (adaptorRef.current)
						callback.call(adaptorRef.current, data.definition, data);
					if (
						data.definition === 'play_finished' ||
              data.definition === 'publish_finished'
					) {
						closePeerConnection(data.streamId);
					}
					break;
				case 'roomInformation':
					if (debug) console.log(' in roomInformation', data);
					callback.call(adaptorRef.current, data.command, data);
					break;
				case 'pong':
					if (debug) console.log(' in pong', data);
					break;
				case 'streamInformation':
					if (debug) console.log(' in streamInformation', data);
					callback.call(adaptorRef.current, data.command, data);
					break;
				case 'trackList':
					if (debug) console.log(' in trackList', data);
					callback.call(adaptorRef.current, data.command, data);
					break;
				case 'connectWithNewId':
					if (debug) console.log(' in connectWithNewId', data);
					callback.call(adaptorRef.current, data.command, data);
					break;
				case 'peerMessageCommand':
					if (debug) console.log(' in peerMessageCommand', data);
					callback.call(adaptorRef.current, data.command, data);
					break;
				default:
					if (debug) console.log(' in default', data);
					callback.call(adaptorRef.current, data.command, data);
					break;
			}
		};

		ws.onerror = (e) => {
			// an error occurred
			if (debug) console.log(e.message);
		};

		ws.onclose = (e) => {
			// connection closed
			if (debug) console.log(e.code, e.reason);
		};
	}, [
		callback,
		callbackError,
		closePeerConnection,
		config,
		debug,
		mediaConstraints,
		startPublishing,
		takeCandidate,
		takeConfiguration,
		ws,
	]);

	const publish = useCallback(
		(
			streamId,
			token,
			subscriberId,
			subscriberCode,
		) => {
			let data = {};
			if (onlyDataChannel) {
				data = {
					command: 'publish',
					streamId: streamId,
					token: token,
					subscriberId: subscriberId !== undefined ? subscriberId : '',
					subscriberCode: subscriberCode !== undefined ? subscriberCode : '',
					video: false,
					audio: false,
				};
			} else {
				if (!localStream.current) return;

				let [video, audio] = [false, false];


				video = localStream.current.getVideoTracks().length > 0;

				audio = localStream.current.getAudioTracks().length > 0;

				data = {
					command: 'publish',
					streamId,
					token,
					subscriberId: subscriberId !== undefined ? subscriberId : '',
					subscriberCode: subscriberCode !== undefined ? subscriberCode : '',
					video,
					audio,
				};
			}

			if (ws) ws.sendJson(data);
		},
		[ws]
	);

	//play
	const play = useCallback(
		(streamId, token, room) => {
			playStreamIds.push(streamId);
			const data = {
				command: 'play',
				streamId,
				token,
				room,
			};

			if (token) {
				data.token = token;
			}

			if (ws) ws.sendJson(data);
		},
		[playStreamIds, ws]
	);

	const stop = useCallback(
		(streamId) => {
			const data = {
				command: 'stop',
				streamId: streamId,
			};
			if (ws) ws.sendJson(data);
		},
		[ws]
	);

	const join = useCallback(
		(streamId) => {
			const data = {
				command: 'join',
				streamId,
			};
			if (ws) ws.sendJson(data);
		},
		[ws]
	);

	const leave = useCallback(
		(streamId) => {
			const data = {
				command: 'leave',
				streamId,
			};
			if (ws) ws.sendJson(data);
		},
		[ws]
	);

	const joinRoom = useCallback((room, streamId) => {
		console.log('joinRoom', room, streamId);
		const data = {
			command: 'joinRoom',
			room,
			streamId,
		};
		setRoomName(room);

		if (ws) ws.sendJson(data);
	}, [ws]);

	const leaveFromRoom = useCallback(
		(room) => {
			const data = {
				command: 'leaveFromRoom',
				room,
			};
			setRoomName(room);
			if (ws) ws.sendJson(data);
		},
		[ws]
	);

	const getRoomInfo = useCallback(
		(room, streamId) => {
			var data = {
				command: 'getRoomInfo',
				streamId,
				room,
			};
			if (ws) ws.sendJson(data);
		},
		[ws]
	);

	//Data Channel
	const peerMessage = useCallback(
		(streamId, definition, data) => {
			const jsCmd = {
				command: 'peerMessageCommand',
				streamId: streamId,
				definition: definition,
				data: data,
			};
			if (ws) ws.sendJson(jsCmd);
		},
		[ws]
	);

	const sendData = useCallback(
		(streamId, message) => {

			const dataChannel = remotePeerConnection[streamId].dataChannel;
			dataChannel.send(message);
			if (debug) console.log(' send message in server', message);
		},
		[ws]
	);

	//adaptor ref
	useEffect(() => {
		adaptorRef.current = {
			publish,
			play,
			stop,
			join,
			leave,
			joinRoom,
			leaveFromRoom,
			getRoomInfo,
			initPeerConnection,
			localStream,
			remoteStreams,
			remoteStreamsMapped,
			peerMessage,
			sendData,
		};
	}, [
		publish,
		play,
		stop,
		localStream,
		remoteStreams,
		remoteStreamsMapped,
		join,
		leave,
		joinRoom,
		leaveFromRoom,
		getRoomInfo,
		initPeerConnection,
		peerMessage,
		sendData,
	]);

	return {
		publish,
		play,
		stop,
		localStream,
		remoteStreams,
		remoteStreamsMapped,
		join,
		leave,
		joinRoom,
		leaveFromRoom,
		getRoomInfo,
		initPeerConnection,
		peerMessage,
		sendData,
	};
}; // useAntmedia fn end

export const rtc_view = (
	stream,
	customStyles = { width: '70%', height: '50%', alignSelf: 'center' }
) =>
{
	const props = {
		stream: stream,
		style: customStyles,
	};

	return <RTCView {...props} />;
};