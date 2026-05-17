import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { createFinance } from '../api';

type Props = NativeStackScreenProps<RootStackParamList, 'AddFinance'>;

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AddFinanceScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('monthly');
  const [debtDate, setDebtDate] = useState(getTodayString());
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const n = name.trim();
    const p = parseFloat(principal);
    const r = parseFloat(rate);
    if (!n) { Alert.alert('Error', 'Enter a person name'); return; }
    if (isNaN(p) || p <= 0) { Alert.alert('Error', 'Enter a valid principal'); return; }
    if (isNaN(r) || r <= 0) { Alert.alert('Error', 'Enter a valid rate'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(debtDate)) { Alert.alert('Error', 'Enter date as YYYY-MM-DD'); return; }

    setSaving(true);
    try {
      await createFinance({ name: n, principal: p, interest_rate: r, period, debt_date: debtDate });
      navigation.goBack();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.form}>
        <Text style={styles.sectionTitle}>Person Details</Text>

        <Text style={styles.label}>Person Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Enter name" placeholderTextColor="#555" />

        <Text style={styles.label}>Debt Date</Text>
        <TextInput style={styles.input} value={debtDate} onChangeText={setDebtDate} placeholder="YYYY-MM-DD" placeholderTextColor="#555" />
        <Text style={styles.hint}>Date when the money was given</Text>

        <Text style={styles.label}>Principal Amount ({'₹'})</Text>
        <TextInput style={styles.input} value={principal} onChangeText={setPrincipal} placeholder="e.g. 10000" placeholderTextColor="#555" keyboardType="numeric" />

        <Text style={styles.sectionTitle}>Interest Details</Text>

        <Text style={styles.label}>Interest Rate (%)</Text>
        <TextInput style={styles.input} value={rate} onChangeText={setRate} placeholder="e.g. 2" placeholderTextColor="#555" keyboardType="decimal-pad" />

        <Text style={styles.label}>Interest Period</Text>
        <View style={styles.periodRow}>
          {(['weekly', 'monthly'] as const).map(p => (
            <TouchableOpacity key={p} style={[styles.periodBtn, period === p && styles.periodBtnActive]} onPress={() => setPeriod(p)}>
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{p === 'weekly' ? 'Weekly' : 'Monthly'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.preview}>
          <Text style={styles.previewTitle}>Preview</Text>
          <Text style={styles.previewText}>
            {principal && rate
              ? `Interest per ${period === 'weekly' ? 'week' : 'month'}: ₹ ${((parseFloat(principal) || 0) * ((parseFloat(rate) || 0) / 100)).toFixed(2)}`
              : 'Enter values to see preview'}
          </Text>
        </View>

        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Entry'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  form: { padding: 20, paddingBottom: 40 },
  sectionTitle: { color: '#e94560', fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 12 },
  label: { color: '#aaa', fontSize: 13, marginBottom: 6, marginTop: 12 },
  hint: { color: '#555', fontSize: 11, marginTop: 4 },
  input: { backgroundColor: '#16213e', borderRadius: 10, padding: 14, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#1a1a2e' },
  periodRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  periodBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#16213e', alignItems: 'center', borderWidth: 2, borderColor: '#16213e' },
  periodBtnActive: { borderColor: '#e94560' },
  periodText: { color: '#888', fontSize: 15, fontWeight: '600' },
  periodTextActive: { color: '#e94560' },
  preview: { backgroundColor: '#16213e', borderRadius: 10, padding: 16, marginTop: 24, alignItems: 'center' },
  previewTitle: { color: '#888', fontSize: 12, marginBottom: 6 },
  previewText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  saveBtn: { backgroundColor: '#e94560', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
