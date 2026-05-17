import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './src/screens/HomeScreen';
import AddFinanceScreen from './src/screens/AddFinanceScreen';
import DetailScreen from './src/screens/DetailScreen';
import AddPaymentScreen from './src/screens/AddPaymentScreen';

export type RootStackParamList = {
  Home: undefined;
  AddFinance: undefined;
  Detail: { id: string };
  AddPayment: { id: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Finance Tracker' }}
        />
        <Stack.Screen
          name="AddFinance"
          component={AddFinanceScreen}
          options={{ title: 'New Finance Entry' }}
        />
        <Stack.Screen
          name="Detail"
          component={DetailScreen}
          options={{ title: 'Finance Details' }}
        />
        <Stack.Screen
          name="AddPayment"
          component={AddPaymentScreen}
          options={{ title: 'Record Payment' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
