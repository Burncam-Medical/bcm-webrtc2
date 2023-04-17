import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaView } from 'react-native';

import Video from '../components/video/Video';

const AppNavigator = () => {
	return (
		<SafeAreaView>
			<NavigationContainer>
				<Video/>
			</NavigationContainer>
		</SafeAreaView>
	);
};

export default AppNavigator;
