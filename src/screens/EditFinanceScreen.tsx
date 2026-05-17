import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { Finance, fetchFinance, updateFinance } from '../api';

type Props = NativeStackScreenProps<RootStackParamList, 'EditFinance'>;

function fmt(n: number) { return '₹ ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

export default function EditFinanceScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [finance, setFinance] = useState<Finance | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('monthly');
  const [debtDate, setDebtDate] = useState('');
  const [remainingPrincipal, setRemainingPrincipal] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchFinance(id);
        setFinance(data);
        setName(data.name);
        setRate(String(data.interest_rate));
        setPeriod(data.period);
        setDebtDate(data.debt_date.split('T')[0]);
        setRemainingPrincipal(String(data.remaining_principal));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading || !finance) {
    return <View style={styles.container}><ActivityIndicator size="large" color="#e94560" style={{ marginTop: 40 }} /></View>;
  }

  const handleSave = async () => {
    const n = name.trim();
    const r = parseFloat(rate);
    const rp = parseFloat(remainingPrincipal);

    if (!n) { Alert.alert('Error', 'Enter a name'); return; }
    if (isNaN(r) || r <= 0) { Alert.alert('Error', 'Enter a valid rate'); return; }
    if (isNaN(rp) || rp < 0) { Alert.alert('Error', 'Enter valid remaining principal'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(debtDate)) { Alert.alert('Error', 'Enter date as YYYY-MM-DD'); return; }

    setSaving(true);
    try {
      await updateFinance(finance.id, {
        name: n,
        interest_rate: r,
        period,
        debt_date: debtDate,
        remaining_principal: rp,
      });
      navigation.goBack();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const hasChanges =
    name.trim() !== finance.name ||
    rate !== String(finance.interest_rate) ||
    period !== finance.period ||
    debtDate !== finance.debt_date.split('T')[0] ||
    remainingPrincipal !== String(finance.remaining_principal);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.form}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Editing: {finance.name}</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Original Principal</Text>
            <Text style={styles.infoValue}>{fmt(finance.original_principal)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Current Interest</Text>
            <Text style={[styles.infoValue, { color: '#e94560' }]}>{fmt(finance.current_interest)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total Paid</Text>
            <Text style={[styles.infoValue, { color: '#4ecca3' }]}>{fmt(finance.total_interest_paid + finance.total_principal_paid)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Edit Details</Text>

        <Text style={styles.label}>Person Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Name" placeholderTextColor="#555" />

        <Text style={styles.label}>Debt Date</Text>
        <TextInput style={styles.input} value={debtDate} onChangeText={setDebtDate} placeholder="YYYY-MM-DD" placeholderTextColor="#555" />

        <Text style={styles.label}>Remaining Principal ({'₹'})</Text>
        <TextInput style={styles.input} value={remainingPrincipal} onChangeText={setRemainingPrincipal} placeholder="Amount" placeholderTextColor="#555" keyboardType="numeric" />
        <Text style={styles.hint}>Original: {fmt(finance.original_principal)}</Text>

        <Text style={styles.sectionTitle}>Interest Settings</Text>

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

        <Text style={styles.note}>
          Note: Current accrued interest will be settled at this moment.{'\n'}
          New interest will start accruing with the updated rate/period from now.
        </Text>

        <TouchableOpacity
          style={[styles.saveBtn, (!hasChanges || saving) && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={!hasChanges || saving}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  form: { padding: 20, paddingBottom: 40 },
  infoCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 8 },
  infoTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  infoLabel: { color: '#888', fontSize: 13 },
  infoValue: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sectionTitle: { color: '#e94560', fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 12 },
  label: { color: '#aaa', fontSize: 13, marginBottom: 6, marginTop: 12 },
  hint: { color: '#555', fontSize: 11, marginTop: 4 },
  input: { backgroundColor: '#16213e', borderRadius: 10, padding: 14, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#1a1a2e' },
  periodRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  periodBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#16213e', alignItems: 'center', borderWidth: 2, borderColor: '#16213e' },
  periodBtnActive: { borderColor: '#e94560' },
  periodText: { color: '#888', fontSize: 15, fontWeight: '600' },
  periodTextActive: { color: '#e94560' },
  note: { color: '#666', fontSize: 11, marginTop: 20, lineHeight: 16, textAlign: 'center', fontStyle: 'italic' },
  saveBtn: { backgroundColor: '#e94560', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
  cancelBtnText: { color: '#888', fontSize: 14, fontWeight: '600' },
});
