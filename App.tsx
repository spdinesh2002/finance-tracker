import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './src/screens/HomeScreen';
import AddFinanceScreen from './src/screens/AddFinanceScreen';
import DetailScreen from './src/screens/DetailScreen';
import AddPaymentScreen from './src/screens/AddPaymentScreen';
import EditFinanceScreen from './src/screens/EditFinanceScreen';

export type RootStackParamList = {
  Home: undefined;
  AddFinance: undefined;
  Detail: { id: string };
  AddPayment: { id: string };
  EditFinance: { id: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function HomeButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={hStyles.btn}>
      <Text style={hStyles.text}>⌂ Home</Text>
    </TouchableOpacity>
  );
}

const hStyles = StyleSheet.create({
  btn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#e94560' },
  text: { color: '#fff', fontSize: 13, fontWeight: '700' },
});

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
          options={({ navigation }) => ({
            title: 'New Finance Entry',
            headerRight: () => <HomeButton onPress={() => navigation.navigate('Home')} />,
          })}
        />
        <Stack.Screen
          name="Detail"
          component={DetailScreen}
          options={({ navigation }) => ({
            title: 'Finance Details',
            headerRight: () => <HomeButton onPress={() => navigation.navigate('Home')} />,
          })}
        />
        <Stack.Screen
          name="AddPayment"
          component={AddPaymentScreen}
          options={({ navigation }) => ({
            title: 'Record Payment',
            headerRight: () => <HomeButton onPress={() => navigation.navigate('Home')} />,
          })}
        />
        <Stack.Screen
          name="EditFinance"
          component={EditFinanceScreen}
          options={({ navigation }) => ({
            title: 'Edit Entry',
            headerRight: () => <HomeButton onPress={() => navigation.navigate('Home')} />,
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
