import React, {useCallback, useRef, useState, useEffect} from 'react';

import {
	View,
	Platform,
	StyleSheet,
	TouchableOpacity,
	Text,
	SafeAreaView,
} from 'react-native';
import { useAntMedia, rtc_view } from './AntMediaLibrary';

export default function Conference() {
	var defaultRoomName = 'bcmTest10001';
	const server = 'test.antmedia.io';
	const webSocketUrl = `ws://${server}:5080/WebRTCAppEE/websocket`;

	const [localMedia, setLocalMedia] = useState('');
	const [remoteStreams, setremoteStreams] = useState([]);

	const [isPlaying, setIsPlaying] = useState(false);
	const [isPublishing, setIsPublishing] = useState(false);
	const [roomId, setRoomId] = useState(defaultRoomName);
	const stream = useRef({id: ''}).current;
	let roomTimerId = useRef(0).current;
	let streamsList = useRef([]).current;
	const [PlayStreamsListArr, updatePlayStreamsListArr] = useState([]);

	let allStreams = [];

	const adaptor = useAntMedia({
		url: webSocketUrl,
		mediaConstraints: {
			audio: false,
			video: {
				width: 640,
				height: 480,
				frameRate: 30,
				facingMode: 'front',
			},
		},
		callback(command, data) {
			let tok;
			switch (command) {
				case 'pong':
					break;
				case 'joinedTheRoom': {
					console.log('joined the room!', roomId);

					tok = data.ATTR_ROOM_NAME;
					adaptor.publish(data.streamId, tok);
					const streams = data.streams;

					if (streams != null) {
						streams.forEach((item) => {
							if (item === stream.id) return;
							adaptor.play(item, tok, roomId);
						});
						streamsList = streams;
						updatePlayStreamsListArr([]);

						//reset media streams
						setremoteStreams([]);

						updatePlayStreamsListArr(streams);
					}

					roomTimerId = setInterval(() => {
						adaptor.getRoomInfo(roomId, data.streamId);
					}, 5000);

					break;
				}
				case 'publish_started':
					setIsPublishing(true);
					break;
				case 'publish_finished':
					streamsList = [];
					setIsPublishing(false);
					break;
				case 'streamJoined':
					adaptor.play(data.streamId, undefined, roomId);
					break;
				case 'leavedFromRoom':
					console.log('leavedFromRoom');

					clearRoomInfoInterval();

					if (PlayStreamsListArr != null) {
						PlayStreamsListArr.forEach(function (item) {
							removeRemoteVideo(item);
						});
					}

					// we need to reset streams list
					updatePlayStreamsListArr([]);

					//reset media streams
					setremoteStreams([]);
					break;
				case 'play_finished':
					console.log('play_finished');
					removeRemoteVideo(data.streamId);
					break;
				case 'roomInformation':
					//Checks if any new stream has added, if yes, plays.
					for (let str of data.streams) {
						if (!PlayStreamsListArr.includes(str)) {
							adaptor.play(str, tok, roomId);
						}
					}

					// Checks if any stream has been removed, if yes, removes the view and stops web rtc connection.
					for (let str of PlayStreamsListArr) {
						if (!data.streams.includes(str)) {
							removeRemoteVideo(str);
						}
					}

					//Lastly updates the current stream list with the fetched one.
					updatePlayStreamsListArr(data.streams);

					console.log(Platform.OS, 'data.streams', data.streams);
					console.log(Platform.OS, 'PlayStreamsListArr', PlayStreamsListArr);

					break;
				default:
					break;
			}
		},
		callbackError: (err, data) => {
			console.error('callbackError', err, data);
			clearRoomInfoInterval();
		},
		peer_connection_config: {
			iceServers: [
				{
					url: 'stun:stun.l.google.com:19302',
				},
			],
		},
		debug: false,
	});

	const clearRoomInfoInterval = () => {
		console.log('interval cleared');
		clearInterval(roomTimerId);
	};

	const handleConnect = useCallback(() => {
		if (adaptor) {
			adaptor.joinRoom(roomId, undefined);
			setIsPlaying(true);
		}
	}, [adaptor, roomId]);

	const handleDisconnect = useCallback(() => {
		if (adaptor) {
			adaptor.leaveFromRoom(roomId);

			allStreams = [];

			clearRoomInfoInterval();
			setIsPlaying(false);
		}
	}, [adaptor, clearRoomInfoInterval, roomId]);

	const removeRemoteVideo = (streamId) => {
		streamsList = [];

		adaptor.stop(streamId);
		streamsList = PlayStreamsListArr.filter((item) => item !== streamId);
		updatePlayStreamsListArr(streamsList);
	};

	useEffect(() => {
		const verify = () => {
			if (adaptor.localStream.current && adaptor.localStream.current) {
				return setLocalMedia(adaptor.localStream.current);
			}
			setTimeout(verify, 5000);
		};
		verify();
	}, [adaptor.localStream]);

	useEffect(() => {
		if (localMedia && remoteStreams) {
			// console.log('InCallManager', InCallManager)
			// InCallManager.start({media: 'video'});
		}
	}, [localMedia, remoteStreams]);

	const getRemoteStreams = () => {
		const remoteStreamArr = [];

		if (adaptor && Object.keys(adaptor.remoteStreamsMapped).length > 0) {
			for (let i in adaptor.remoteStreamsMapped) {
				let st = adaptor.remoteStreamsMapped[i] ? adaptor.remoteStreamsMapped[i] : null;

				if (PlayStreamsListArr.includes(i)) {
					if (st) remoteStreamArr.push(st);
				}
			}
		}

		setremoteStreams(remoteStreamArr);
	};

	useEffect(() => {
		const remoteStreamArr = [];

		if (adaptor && Object.keys(adaptor.remoteStreamsMapped).length > 0) {
			for (let i in adaptor.remoteStreamsMapped) {
				let st = adaptor.remoteStreamsMapped[i] ? adaptor.remoteStreamsMapped[i]: null;

				if (PlayStreamsListArr.includes(i)) {
					if (st) remoteStreamArr.push(st);
				}
			}
		}

		setremoteStreams(remoteStreamArr);
	}, [adaptor.remoteStreamsMapped]);

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.box}>
				<Text style={styles.heading}>Ant Media WebRTC Conference</Text>
				<Text style={styles.heading}>Local Stream</Text>
				{localMedia ? <>{rtc_view(localMedia, styles.localPlayer)}</> : <></>}
				{!isPlaying ? (
					<>
						<TouchableOpacity onPress={handleConnect} style={styles.button}>
							<Text>Join Room</Text>
						</TouchableOpacity>
					</>
				) : (
					<>
						<Text style={styles.heading1}>Remote Streams</Text>
						{remoteStreams.length <= 3 ? (
							<>
								<View
									style={styles.remoteContainer}>
									{remoteStreams.map((a, index) => {
										const count = remoteStreams.length;
										console.log('Remote stream count', count);
										if (a)
											return (
												<View key={index}>
													<>{rtc_view(a, styles.players)}</>
												</View>
											);
									})}
								</View>
							</>
						) : (
							<></>
						)}
						<TouchableOpacity style={styles.button} onPress={handleDisconnect}>
							<Text style={styles.btnTxt}>Leave Room</Text>
						</TouchableOpacity>
					</>
				)}
				<TouchableOpacity style={styles.button} onPress={getRemoteStreams}>
					<Text style={styles.btnTxt}>Refresh Room</Text>
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	remoteContainer: {
		flexDirection: 'row',
		alignSelf: 'center',
		margin: 5,
		backgroundColor: 'red',
	},
	box: {
		alignSelf: 'center',
		width: '80%',
		height: '80%',
	},
	players: {
		backgroundColor: '#FFF',
		paddingVertical: 5,
		paddingHorizontal: 10,
		margin: 5,
		width: 100,
		height: 150,
		justifyContent: 'center',
		alignSelf: 'center',
	},
	localPlayer: {
		backgroundColor: '#FFF',
		borderRadius: 5,
		marginBottom: 5,
		height: 180,
		flexDirection: 'row',
	},
	btnTxt: {
		color: '#111',
	},
	button: {
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#DDD',
		padding: 10,
		height: 40,
		width: '100%',
		marginTop: 20,
	},
	heading: {
		alignSelf: 'center',
		marginBottom: 5,
		padding: 2,
	},
	heading1: {
		alignSelf: 'center',
		marginTop: 20,
	},
});
