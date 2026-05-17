import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { Finance } from '../types';
import { loadFinances, deleteFinance } from '../storage';
import {
  calculateCurrentInterest,
  formatCurrency,
  formatDate,
} from '../utils/interest';

type Props = NativeStackScreenProps<RootStackParamList, 'Detail'>;

export default function DetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [finance, setFinance] = useState<Finance | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const all = await loadFinances();
        const found = all.find((r) => r.id === id);
        setFinance(found ?? null);
      })();
    }, [id])
  );

  if (!finance) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Record not found</Text>
      </View>
    );
  }

  const currentInterest = calculateCurrentInterest(finance);
  const totalDue = finance.remainingPrincipal + currentInterest;
  const isClosed = finance.status === 'closed';

  const handleDelete = () => {
    Alert.alert('Delete Entry', `Delete finance record for ${finance.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteFinance(finance.id);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.personName}>{finance.name}</Text>
        <View style={[styles.badge, isClosed ? styles.badgeClosed : styles.badgeActive]}>
          <Text style={styles.badgeText}>{isClosed ? 'CLOSED' : 'ACTIVE'}</Text>
        </View>
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Due</Text>
        <Text style={styles.totalValue}>{formatCurrency(totalDue)}</Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.gridItem}>
          <Text style={styles.gridLabel}>Original Principal</Text>
          <Text style={styles.gridValue}>{formatCurrency(finance.originalPrincipal)}</Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.gridLabel}>Remaining Principal</Text>
          <Text style={styles.gridValue}>{formatCurrency(finance.remainingPrincipal)}</Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.gridLabel}>Accrued Interest</Text>
          <Text style={[styles.gridValue, styles.interestColor]}>
            {formatCurrency(currentInterest)}
          </Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.gridLabel}>Interest Rate</Text>
          <Text style={styles.gridValue}>
            {finance.interestRate}% / {finance.period === 'weekly' ? 'week' : 'month'}
          </Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.gridLabel}>Start Date</Text>
          <Text style={styles.gridValue}>{formatDate(finance.startDate)}</Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.gridLabel}>Total Interest Paid</Text>
          <Text style={[styles.gridValue, styles.paidColor]}>
            {formatCurrency(finance.totalInterestPaid)}
          </Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.gridLabel}>Total Principal Paid</Text>
          <Text style={[styles.gridValue, styles.paidColor]}>
            {formatCurrency(finance.totalPrincipalPaid)}
          </Text>
        </View>
        {isClosed && finance.closedDate && (
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Closed Date</Text>
            <Text style={styles.gridValue}>{formatDate(finance.closedDate)}</Text>
          </View>
        )}
      </View>

      {!isClosed && (
        <TouchableOpacity
          style={styles.payBtn}
          onPress={() => navigation.navigate('AddPayment', { id: finance.id })}
        >
          <Text style={styles.payBtnText}>Record Payment</Text>
        </TouchableOpacity>
      )}

      <View style={styles.historySection}>
        <Text style={styles.historyTitle}>
          Payment History ({finance.payments.length})
        </Text>
        {finance.payments.length === 0 ? (
          <Text style={styles.noPayments}>No payments yet</Text>
        ) : (
          [...finance.payments].reverse().map((p) => (
            <View key={p.id} style={styles.paymentCard}>
              <View style={styles.paymentHeader}>
                <Text style={styles.paymentDate}>{formatDate(p.date)}</Text>
                <Text style={styles.paymentTotal}>
                  {formatCurrency(p.amount)}
                </Text>
              </View>
              <View style={styles.paymentBreakdown}>
                {p.toInterest > 0 && (
                  <Text style={styles.breakdownText}>
                    Interest: {formatCurrency(p.toInterest)}
                  </Text>
                )}
                {p.toPrincipal > 0 && (
                  <Text style={styles.breakdownText}>
                    Principal: {formatCurrency(p.toPrincipal)}
                  </Text>
                )}
              </View>
            </View>
          ))
        )}
      </View>

      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
        <Text style={styles.deleteBtnText}>Delete Entry</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  content: { padding: 20, paddingBottom: 40 },
  emptyText: { color: '#888', textAlign: 'center', marginTop: 40, fontSize: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  personName: { color: '#fff', fontSize: 26, fontWeight: '700', flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeActive: { backgroundColor: '#e94560' },
  badgeClosed: { backgroundColor: '#4ecca3' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  totalCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  totalLabel: { color: '#888', fontSize: 14, marginBottom: 6 },
  totalValue: { color: '#fff', fontSize: 32, fontWeight: '800' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  gridItem: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 14,
    width: '48%',
    flexGrow: 1,
  },
  gridLabel: { color: '#888', fontSize: 11, marginBottom: 4 },
  gridValue: { color: '#fff', fontSize: 16, fontWeight: '700' },
  interestColor: { color: '#e94560' },
  paidColor: { color: '#4ecca3' },
  payBtn: {
    backgroundColor: '#4ecca3',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  payBtnText: { color: '#0f0f23', fontSize: 16, fontWeight: '700' },
  historySection: { marginBottom: 24 },
  historyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  noPayments: { color: '#555', fontSize: 14, textAlign: 'center', padding: 20 },
  paymentCard: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  paymentDate: { color: '#aaa', fontSize: 13 },
  paymentTotal: { color: '#fff', fontSize: 15, fontWeight: '700' },
  paymentBreakdown: { flexDirection: 'row', gap: 16 },
  breakdownText: { color: '#888', fontSize: 12 },
  deleteBtn: {
    borderWidth: 1,
    borderColor: '#e94560',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  deleteBtnText: { color: '#e94560', fontSize: 14, fontWeight: '600' },
});
