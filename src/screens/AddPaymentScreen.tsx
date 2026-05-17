import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { Finance, fetchFinance, addPayment } from '../api';

type Props = NativeStackScreenProps<RootStackParamList, 'AddPayment'>;
type PType = 'interest' | 'principal' | 'both';

function fmt(n: number) { return '₹ ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

export default function AddPaymentScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [finance, setFinance] = useState<Finance | null>(null);
  const [loading, setLoading] = useState(true);
  const [ptype, setPtype] = useState<PType>('both');
  const [intAmt, setIntAmt] = useState('');
  const [prinAmt, setPrinAmt] = useState('');
  const [totalAmt, setTotalAmt] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try { setFinance(await fetchFinance(id)); } catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, [id]);

  if (loading || !finance) return <View style={styles.container}><ActivityIndicator size="large" color="#e94560" style={{ marginTop: 40 }} /></View>;

  const handleSave = async () => {
    let ti = 0, tp = 0;
    if (ptype === 'interest') { ti = parseFloat(totalAmt); if (isNaN(ti) || ti <= 0) { Alert.alert('Error', 'Enter a valid amount'); return; } }
    else if (ptype === 'principal') { tp = parseFloat(totalAmt); if (isNaN(tp) || tp <= 0) { Alert.alert('Error', 'Enter a valid amount'); return; } }
    else { ti = parseFloat(intAmt) || 0; tp = parseFloat(prinAmt) || 0; if (ti <= 0 && tp <= 0) { Alert.alert('Error', 'Enter at least one amount'); return; } }

    setSaving(true);
    try { await addPayment(finance.id, { to_interest: ti, to_principal: tp }); navigation.goBack(); }
    catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.form}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryName}>{finance.name}</Text>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Remaining Principal</Text><Text style={styles.summaryValue}>{fmt(finance.remaining_principal)}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Current Interest</Text><Text style={[styles.summaryValue, { color: '#e94560' }]}>{fmt(finance.current_interest)}</Text></View>
          <View style={[styles.summaryRow, styles.summaryTotal]}><Text style={styles.summaryLabel}>Total Due</Text><Text style={[styles.summaryValue, { fontSize: 18 }]}>{fmt(finance.total_due)}</Text></View>
        </View>

        <Text style={styles.sectionTitle}>Payment Type</Text>
        <View style={styles.typeRow}>
          {([{ k: 'interest' as PType, l: 'Interest Only' }, { k: 'principal' as PType, l: 'Principal Only' }, { k: 'both' as PType, l: 'Both' }]).map(o => (
            <TouchableOpacity key={o.k} style={[styles.typeBtn, ptype === o.k && styles.typeBtnActive]} onPress={() => { setPtype(o.k); setTotalAmt(''); setIntAmt(''); setPrinAmt(''); }}>
              <Text style={[styles.typeText, ptype === o.k && styles.typeTextActive]}>{o.l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {ptype === 'both' ? (
          <>
            <Text style={styles.label}>Interest Payment ({'₹'})</Text>
            <TextInput style={styles.input} value={intAmt} onChangeText={setIntAmt} placeholder={`Max: ${finance.current_interest.toFixed(2)}`} placeholderTextColor="#555" keyboardType="numeric" />
            <Text style={styles.label}>Principal Payment ({'₹'})</Text>
            <TextInput style={styles.input} value={prinAmt} onChangeText={setPrinAmt} placeholder={`Max: ${finance.remaining_principal.toFixed(2)}`} placeholderTextColor="#555" keyboardType="numeric" />
          </>
        ) : (
          <>
            <Text style={styles.label}>{ptype === 'interest' ? 'Interest' : 'Principal'} Amount ({'₹'})</Text>
            <TextInput style={styles.input} value={totalAmt} onChangeText={setTotalAmt}
              placeholder={`Max: ${(ptype === 'interest' ? finance.current_interest : finance.remaining_principal).toFixed(2)}`}
              placeholderTextColor="#555" keyboardType="numeric" />
            <TouchableOpacity style={styles.maxBtn} onPress={() => setTotalAmt((ptype === 'interest' ? finance.current_interest : finance.remaining_principal).toFixed(2))}>
              <Text style={styles.maxBtnText}>Pay Full Amount</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Processing...' : 'Confirm Payment'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  form: { padding: 20, paddingBottom: 40 },
  summaryCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 18, marginBottom: 20 },
  summaryName: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryTotal: { borderTopWidth: 1, borderTopColor: '#333', paddingTop: 10, marginTop: 6 },
  summaryLabel: { color: '#888', fontSize: 14 },
  summaryValue: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sectionTitle: { color: '#e94560', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  typeBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#16213e', alignItems: 'center', borderWidth: 2, borderColor: '#16213e' },
  typeBtnActive: { borderColor: '#e94560' },
  typeText: { color: '#888', fontSize: 12, fontWeight: '600' },
  typeTextActive: { color: '#e94560' },
  label: { color: '#aaa', fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#16213e', borderRadius: 10, padding: 14, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#1a1a2e' },
  maxBtn: { alignSelf: 'flex-end', marginTop: 8, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, backgroundColor: '#1a1a2e' },
  maxBtnText: { color: '#4ecca3', fontSize: 12, fontWeight: '600' },
  saveBtn: { backgroundColor: '#4ecca3', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 30 },
  saveBtnText: { color: '#0f0f23', fontSize: 16, fontWeight: '700' },
});
