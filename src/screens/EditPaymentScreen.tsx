import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { Finance, Payment, fetchFinance, updatePayment } from '../api';

type Props = NativeStackScreenProps<RootStackParamList, 'EditPayment'>;

function fmt(n: number) { return '₹ ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function fmtDate(s: string) { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }

export default function EditPaymentScreen({ route, navigation }: Props) {
  const { financeId, paymentId } = route.params;
  const [finance, setFinance] = useState<Finance | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);

  const [intAmt, setIntAmt] = useState('');
  const [prinAmt, setPrinAmt] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchFinance(financeId);
        setFinance(data);
        const p = data.payments?.find(pay => pay.id === paymentId);
        if (p) {
          setPayment(p);
          setIntAmt(p.to_interest > 0 ? String(p.to_interest) : '');
          setPrinAmt(p.to_principal > 0 ? String(p.to_principal) : '');
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [financeId, paymentId]);

  if (loading || !finance || !payment) {
    return <View style={styles.container}><ActivityIndicator size="large" color="#e94560" style={{ marginTop: 40 }} /></View>;
  }

  const hasChanges =
    (intAmt !== (payment.to_interest > 0 ? String(payment.to_interest) : '')) ||
    (prinAmt !== (payment.to_principal > 0 ? String(payment.to_principal) : ''));

  const handleSave = async () => {
    const ti = parseFloat(intAmt) || 0;
    const tp = parseFloat(prinAmt) || 0;

    if (ti <= 0 && tp <= 0) {
      Alert.alert('Error', 'Enter at least one amount');
      return;
    }

    setSaving(true);
    try {
      await updatePayment(financeId, paymentId, { to_interest: ti, to_principal: tp });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.form}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Editing Payment</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Person</Text>
            <Text style={styles.infoValue}>{finance.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Payment Date</Text>
            <Text style={styles.infoValue}>{fmtDate(payment.date)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Original Amount</Text>
            <Text style={styles.infoValue}>{fmt(payment.amount)}</Text>
          </View>
        </View>

        <View style={styles.currentCard}>
          <Text style={styles.currentTitle}>Current Breakdown</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Interest Paid</Text>
            <Text style={[styles.infoValue, { color: '#e94560' }]}>{fmt(payment.to_interest)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Principal Paid</Text>
            <Text style={[styles.infoValue, { color: '#4ecca3' }]}>{fmt(payment.to_principal)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>New Amounts</Text>

        <Text style={styles.label}>Interest Payment (₹)</Text>
        <TextInput
          style={styles.input}
          value={intAmt}
          onChangeText={setIntAmt}
          placeholder="0"
          placeholderTextColor="#555"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Principal Payment (₹)</Text>
        <TextInput
          style={styles.input}
          value={prinAmt}
          onChangeText={setPrinAmt}
          placeholder="0"
          placeholderTextColor="#555"
          keyboardType="numeric"
        />

        <Text style={styles.note}>
          Note: Changing payment amounts will adjust the finance record's{'\n'}
          remaining principal and total paid amounts accordingly.
        </Text>

        <TouchableOpacity
          style={[styles.saveBtn, (!hasChanges || saving) && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={!hasChanges || saving}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Update Payment'}</Text>
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
  infoCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 12 },
  infoTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  infoLabel: { color: '#888', fontSize: 13 },
  infoValue: { color: '#fff', fontSize: 14, fontWeight: '600' },
  currentCard: { backgroundColor: '#16213e', borderRadius: 12, padding: 16, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#e94560' },
  currentTitle: { color: '#e94560', fontSize: 15, fontWeight: '700', marginBottom: 10 },
  sectionTitle: { color: '#e94560', fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 12 },
  label: { color: '#aaa', fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#16213e', borderRadius: 10, padding: 14, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#1a1a2e' },
  note: { color: '#666', fontSize: 11, marginTop: 20, lineHeight: 16, textAlign: 'center', fontStyle: 'italic' },
  saveBtn: { backgroundColor: '#e94560', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
  cancelBtnText: { color: '#888', fontSize: 14, fontWeight: '600' },
});
