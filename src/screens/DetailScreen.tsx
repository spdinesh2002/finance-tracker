import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { Finance, fetchFinance, deleteFinanceRecord, deletePayment } from '../api';

type Props = NativeStackScreenProps<RootStackParamList, 'Detail'>;

function fmt(n: number) { return '₹ ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function fmtDate(s: string) { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }

export default function DetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [finance, setFinance] = useState<Finance | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    (async () => {
      try { setFinance(await fetchFinance(id)); } catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, [id]));

  if (loading) return <View style={styles.container}><ActivityIndicator size="large" color="#e94560" style={{ marginTop: 40 }} /></View>;
  if (!finance) return <View style={styles.container}><Text style={styles.emptyText}>Record not found</Text></View>;

  const closed = finance.status === 'closed';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.personName}>{finance.name}</Text>
        <View style={[styles.badge, closed ? styles.badgeClosed : styles.badgeActive]}><Text style={styles.badgeText}>{closed ? 'CLOSED' : 'ACTIVE'}</Text></View>
      </View>
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Due</Text>
        <Text style={styles.totalValue}>{fmt(finance.total_due)}</Text>
      </View>
      <View style={styles.grid}>
        <View style={styles.gridItem}><Text style={styles.gridLabel}>Original Principal</Text><Text style={styles.gridValue}>{fmt(finance.original_principal)}</Text></View>
        <View style={styles.gridItem}><Text style={styles.gridLabel}>Remaining Principal</Text><Text style={styles.gridValue}>{fmt(finance.remaining_principal)}</Text></View>
        <View style={styles.gridItem}><Text style={styles.gridLabel}>Current Interest</Text><Text style={[styles.gridValue, styles.interestColor]}>{fmt(finance.current_interest)}</Text></View>
        <View style={styles.gridItem}><Text style={styles.gridLabel}>Interest Rate</Text><Text style={styles.gridValue}>{finance.interest_rate}% / {finance.period === 'weekly' ? 'week' : 'month'}</Text></View>
        <View style={styles.gridItem}><Text style={styles.gridLabel}>Debt Date</Text><Text style={styles.gridValue}>{fmtDate(finance.debt_date)}</Text></View>
        <View style={styles.gridItem}><Text style={styles.gridLabel}>Total Interest Paid</Text><Text style={[styles.gridValue, styles.paidColor]}>{fmt(finance.total_interest_paid)}</Text></View>
        <View style={styles.gridItem}><Text style={styles.gridLabel}>Total Principal Paid</Text><Text style={[styles.gridValue, styles.paidColor]}>{fmt(finance.total_principal_paid)}</Text></View>
        {closed && finance.closed_date && <View style={styles.gridItem}><Text style={styles.gridLabel}>Closed Date</Text><Text style={styles.gridValue}>{fmtDate(finance.closed_date)}</Text></View>}
      </View>

      {!closed && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.payBtn} onPress={() => navigation.navigate('AddPayment', { id: finance.id })}>
            <Text style={styles.payBtnText}>Record Payment</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('EditFinance', { id: finance.id })}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.historySection}>
        <Text style={styles.historyTitle}>Payment History ({finance.payments?.length || 0})</Text>
        {!finance.payments?.length ? <Text style={styles.noPayments}>No payments yet</Text> :
          finance.payments.map(p => (
            <View key={p.id} style={styles.paymentCard}>
              <View style={styles.paymentHeader}>
                <Text style={styles.paymentDate}>{fmtDate(p.date)}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={styles.paymentTotal}>{fmt(p.amount)}</Text>
                  <TouchableOpacity style={styles.payEditBtn} onPress={() => navigation.navigate('EditPayment', { financeId: finance.id, paymentId: p.id })}>
                    <Text style={styles.payEditText}>✎</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.payDeleteBtn} onPress={() => {
                    Alert.alert('Delete Payment', `Delete this payment of ${fmt(p.amount)}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: async () => {
                        try {
                          await deletePayment(finance.id, p.id);
                          setLoading(true);
                          setFinance(await fetchFinance(id));
                          setLoading(false);
                        } catch (e: any) { Alert.alert('Error', e.message); }
                      }},
                    ]);
                  }}>
                    <Text style={styles.payDeleteText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.paymentBreakdown}>
                {p.to_interest > 0 && <Text style={styles.breakdownText}>Interest: {fmt(p.to_interest)}</Text>}
                {p.to_principal > 0 && <Text style={styles.breakdownText}>Principal: {fmt(p.to_principal)}</Text>}
              </View>
            </View>
          ))
        }
      </View>

      <TouchableOpacity style={styles.deleteBtn} onPress={() => {
        Alert.alert('Delete', `Delete record for ${finance.name}?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: async () => { await deleteFinanceRecord(finance.id); navigation.goBack(); } },
        ]);
      }}>
        <Text style={styles.deleteBtnText}>Delete Entry</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  content: { padding: 20, paddingBottom: 40 },
  emptyText: { color: '#888', textAlign: 'center', marginTop: 40, fontSize: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  personName: { color: '#fff', fontSize: 26, fontWeight: '700', flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeActive: { backgroundColor: '#e94560' },
  badgeClosed: { backgroundColor: '#4ecca3' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  totalCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20 },
  totalLabel: { color: '#888', fontSize: 14, marginBottom: 6 },
  totalValue: { color: '#fff', fontSize: 32, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  gridItem: { backgroundColor: '#16213e', borderRadius: 10, padding: 14, width: '48%', flexGrow: 1 },
  gridLabel: { color: '#888', fontSize: 11, marginBottom: 4 },
  gridValue: { color: '#fff', fontSize: 16, fontWeight: '700' },
  interestColor: { color: '#e94560' },
  paidColor: { color: '#4ecca3' },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  payBtn: { flex: 1, backgroundColor: '#4ecca3', borderRadius: 10, padding: 16, alignItems: 'center' },
  payBtnText: { color: '#0f0f23', fontSize: 16, fontWeight: '700' },
  editBtn: { backgroundColor: '#16213e', borderRadius: 10, padding: 16, alignItems: 'center', borderWidth: 2, borderColor: '#e94560', paddingHorizontal: 24 },
  editBtnText: { color: '#e94560', fontSize: 16, fontWeight: '700' },
  historySection: { marginBottom: 24 },
  historyTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  noPayments: { color: '#555', fontSize: 14, textAlign: 'center', padding: 20 },
  paymentCard: { backgroundColor: '#16213e', borderRadius: 10, padding: 14, marginBottom: 8 },
  paymentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  paymentDate: { color: '#aaa', fontSize: 13 },
  paymentTotal: { color: '#fff', fontSize: 15, fontWeight: '700' },
  paymentBreakdown: { flexDirection: 'row', gap: 16 },
  breakdownText: { color: '#888', fontSize: 12 },
  payEditBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' },
  payEditText: { color: '#4ecca3', fontSize: 14, fontWeight: '700' },
  payDeleteBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#2a1525', justifyContent: 'center', alignItems: 'center' },
  payDeleteText: { color: '#e94560', fontSize: 12, fontWeight: '700' },
  deleteBtn: { borderWidth: 1, borderColor: '#e94560', borderRadius: 10, padding: 14, alignItems: 'center' },
  deleteBtnText: { color: '#e94560', fontSize: 14, fontWeight: '600' },
});
