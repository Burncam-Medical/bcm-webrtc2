// Import libraries

import React, { useCallback, useEffect, useState } from 'react';
import 'react-native-reanimated';
import { SafeAreaView, StatusBar, Text } from 'react-native';
import AppNavigator from './navigation/AppNavigator';
import * as SplashScreen from 'expo-splash-screen';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const App = () => {

	const [appIsReady, setAppIsReady] = useState(false);

	useEffect(() => {
		setAppIsReady(true);
	}, []);

	const onLayoutRootView = useCallback(async () => {
		if (appIsReady) await SplashScreen.hideAsync();
	}, [appIsReady]);

	if (!appIsReady) return null;

	return (
		<SafeAreaView onLayout={onLayoutRootView}>
			<StatusBar backgroundColor={'#FFF'}/>
			<AppNavigator/>
		</SafeAreaView>
	);
};



export default App;