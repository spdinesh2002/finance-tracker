import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { Finance, Period } from '../types';
import { addFinance } from '../storage';
import { generateId } from '../utils/interest';

type Props = NativeStackScreenProps<RootStackParamList, 'AddFinance'>;

export default function AddFinanceScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [period, setPeriod] = useState<Period>('monthly');

  const handleSave = async () => {
    const trimmedName = name.trim();
    const principalNum = parseFloat(principal);
    const rateNum = parseFloat(rate);

    if (!trimmedName) {
      Alert.alert('Error', 'Please enter a person name');
      return;
    }
    if (isNaN(principalNum) || principalNum <= 0) {
      Alert.alert('Error', 'Please enter a valid principal amount');
      return;
    }
    if (isNaN(rateNum) || rateNum <= 0) {
      Alert.alert('Error', 'Please enter a valid interest rate');
      return;
    }

    const now = new Date().toISOString();
    const record: Finance = {
      id: generateId(),
      name: trimmedName,
      originalPrincipal: principalNum,
      remainingPrincipal: principalNum,
      interestRate: rateNum,
      period,
      startDate: now,
      lastInterestCalcDate: now,
      accruedInterest: 0,
      totalInterestPaid: 0,
      totalPrincipalPaid: 0,
      payments: [],
      status: 'active',
    };

    await addFinance(record);
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.form}>
        <Text style={styles.sectionTitle}>Person Details</Text>

        <Text style={styles.label}>Person Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Enter name"
          placeholderTextColor="#555"
        />

        <Text style={styles.label}>Principal Amount (\u20B9)</Text>
        <TextInput
          style={styles.input}
          value={principal}
          onChangeText={setPrincipal}
          placeholder="e.g. 10000"
          placeholderTextColor="#555"
          keyboardType="numeric"
        />

        <Text style={styles.sectionTitle}>Interest Details</Text>

        <Text style={styles.label}>Interest Rate (%)</Text>
        <TextInput
          style={styles.input}
          value={rate}
          onChangeText={setRate}
          placeholder="e.g. 2"
          placeholderTextColor="#555"
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Interest Period</Text>
        <View style={styles.periodRow}>
          <TouchableOpacity
            style={[styles.periodBtn, period === 'weekly' && styles.periodBtnActive]}
            onPress={() => setPeriod('weekly')}
          >
            <Text style={[styles.periodText, period === 'weekly' && styles.periodTextActive]}>
              Weekly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodBtn, period === 'monthly' && styles.periodBtnActive]}
            onPress={() => setPeriod('monthly')}
          >
            <Text style={[styles.periodText, period === 'monthly' && styles.periodTextActive]}>
              Monthly
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.preview}>
          <Text style={styles.previewTitle}>Preview</Text>
          <Text style={styles.previewText}>
            {principal && rate
              ? `Interest per ${period === 'weekly' ? 'week' : 'month'}: \u20B9 ${(
                  (parseFloat(principal) || 0) *
                  ((parseFloat(rate) || 0) / 100)
                ).toFixed(2)}`
              : 'Enter values to see preview'}
          </Text>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save Entry</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  form: { padding: 20, paddingBottom: 40 },
  sectionTitle: {
    color: '#e94560',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 12,
  },
  label: { color: '#aaa', fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#1a1a2e',
  },
  periodRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  periodBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#16213e',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#16213e',
  },
  periodBtnActive: { borderColor: '#e94560' },
  periodText: { color: '#888', fontSize: 15, fontWeight: '600' },
  periodTextActive: { color: '#e94560' },
  preview: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 16,
    marginTop: 24,
    alignItems: 'center',
  },
  previewTitle: { color: '#888', fontSize: 12, marginBottom: 6 },
  previewText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  saveBtn: {
    backgroundColor: '#e94560',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
