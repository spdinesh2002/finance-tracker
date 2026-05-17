import React, { useState, useEffect } from 'react';
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
import { Finance } from '../types';
import { loadFinances, updateFinance } from '../storage';
import {
  calculateCurrentInterest,
  generateId,
  formatCurrency,
} from '../utils/interest';

type Props = NativeStackScreenProps<RootStackParamList, 'AddPayment'>;

type PaymentType = 'interest' | 'principal' | 'both';

export default function AddPaymentScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [finance, setFinance] = useState<Finance | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType>('both');
  const [interestAmount, setInterestAmount] = useState('');
  const [principalAmount, setPrincipalAmount] = useState('');
  const [totalAmount, setTotalAmount] = useState('');

  useEffect(() => {
    (async () => {
      const all = await loadFinances();
      const found = all.find((r) => r.id === id);
      setFinance(found ?? null);
    })();
  }, [id]);

  if (!finance) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Loading...</Text>
      </View>
    );
  }

  const currentInterest = calculateCurrentInterest(finance);
  const now = new Date();

  const handleSave = async () => {
    let toInterest = 0;
    let toPrincipal = 0;

    if (paymentType === 'interest') {
      toInterest = parseFloat(totalAmount);
      if (isNaN(toInterest) || toInterest <= 0) {
        Alert.alert('Error', 'Enter a valid amount');
        return;
      }
      if (toInterest > currentInterest + 0.01) {
        Alert.alert('Error', `Interest due is only ${formatCurrency(currentInterest)}`);
        return;
      }
    } else if (paymentType === 'principal') {
      toPrincipal = parseFloat(totalAmount);
      if (isNaN(toPrincipal) || toPrincipal <= 0) {
        Alert.alert('Error', 'Enter a valid amount');
        return;
      }
      if (toPrincipal > finance.remainingPrincipal + 0.01) {
        Alert.alert('Error', `Remaining principal is only ${formatCurrency(finance.remainingPrincipal)}`);
        return;
      }
    } else {
      toInterest = parseFloat(interestAmount) || 0;
      toPrincipal = parseFloat(principalAmount) || 0;
      if (toInterest <= 0 && toPrincipal <= 0) {
        Alert.alert('Error', 'Enter at least one amount');
        return;
      }
      if (toInterest > currentInterest + 0.01) {
        Alert.alert('Error', `Interest due is only ${formatCurrency(currentInterest)}`);
        return;
      }
      if (toPrincipal > finance.remainingPrincipal + 0.01) {
        Alert.alert('Error', `Remaining principal is only ${formatCurrency(finance.remainingPrincipal)}`);
        return;
      }
    }

    toInterest = Math.min(toInterest, currentInterest);
    toPrincipal = Math.min(toPrincipal, finance.remainingPrincipal);

    const newRemainingPrincipal = Math.max(0, finance.remainingPrincipal - toPrincipal);
    const newAccruedInterest = Math.max(0, currentInterest - toInterest);

    const updated: Finance = {
      ...finance,
      remainingPrincipal: Math.round(newRemainingPrincipal * 100) / 100,
      accruedInterest: Math.round(newAccruedInterest * 100) / 100,
      lastInterestCalcDate: now.toISOString(),
      totalInterestPaid: Math.round((finance.totalInterestPaid + toInterest) * 100) / 100,
      totalPrincipalPaid: Math.round((finance.totalPrincipalPaid + toPrincipal) * 100) / 100,
      payments: [
        ...finance.payments,
        {
          id: generateId(),
          date: now.toISOString(),
          amount: Math.round((toInterest + toPrincipal) * 100) / 100,
          toInterest: Math.round(toInterest * 100) / 100,
          toPrincipal: Math.round(toPrincipal * 100) / 100,
        },
      ],
    };

    if (updated.remainingPrincipal === 0 && updated.accruedInterest === 0) {
      updated.status = 'closed';
      updated.closedDate = now.toISOString();
    }

    await updateFinance(updated);
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.form}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryName}>{finance.name}</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Remaining Principal</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(finance.remainingPrincipal)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Accrued Interest</Text>
            <Text style={[styles.summaryValue, styles.interestColor]}>
              {formatCurrency(currentInterest)}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.summaryLabel}>Total Due</Text>
            <Text style={[styles.summaryValue, styles.totalColor]}>
              {formatCurrency(finance.remainingPrincipal + currentInterest)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Payment Type</Text>
        <View style={styles.typeRow}>
          {([
            { key: 'interest', label: 'Interest Only' },
            { key: 'principal', label: 'Principal Only' },
            { key: 'both', label: 'Both' },
          ] as const).map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.typeBtn, paymentType === opt.key && styles.typeBtnActive]}
              onPress={() => {
                setPaymentType(opt.key);
                setTotalAmount('');
                setInterestAmount('');
                setPrincipalAmount('');
              }}
            >
              <Text
                style={[styles.typeText, paymentType === opt.key && styles.typeTextActive]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {paymentType === 'both' ? (
          <>
            <Text style={styles.label}>Interest Payment (\u20B9)</Text>
            <TextInput
              style={styles.input}
              value={interestAmount}
              onChangeText={setInterestAmount}
              placeholder={`Max: ${currentInterest.toFixed(2)}`}
              placeholderTextColor="#555"
              keyboardType="numeric"
            />
            <Text style={styles.label}>Principal Payment (\u20B9)</Text>
            <TextInput
              style={styles.input}
              value={principalAmount}
              onChangeText={setPrincipalAmount}
              placeholder={`Max: ${finance.remainingPrincipal.toFixed(2)}`}
              placeholderTextColor="#555"
              keyboardType="numeric"
            />
          </>
        ) : (
          <>
            <Text style={styles.label}>
              {paymentType === 'interest' ? 'Interest' : 'Principal'} Amount (\u20B9)
            </Text>
            <TextInput
              style={styles.input}
              value={totalAmount}
              onChangeText={setTotalAmount}
              placeholder={`Max: ${(paymentType === 'interest'
                ? currentInterest
                : finance.remainingPrincipal
              ).toFixed(2)}`}
              placeholderTextColor="#555"
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={styles.maxBtn}
              onPress={() =>
                setTotalAmount(
                  (paymentType === 'interest'
                    ? currentInterest
                    : finance.remainingPrincipal
                  ).toFixed(2)
                )
              }
            >
              <Text style={styles.maxBtnText}>Pay Full Amount</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Confirm Payment</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  form: { padding: 20, paddingBottom: 40 },
  emptyText: { color: '#888', textAlign: 'center', marginTop: 40, fontSize: 16 },
  summaryCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 18,
    marginBottom: 20,
  },
  summaryName: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 14 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 10,
    marginTop: 6,
  },
  summaryLabel: { color: '#888', fontSize: 14 },
  summaryValue: { color: '#fff', fontSize: 15, fontWeight: '700' },
  interestColor: { color: '#e94560' },
  totalColor: { color: '#fff', fontSize: 18 },
  sectionTitle: {
    color: '#e94560',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  typeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#16213e',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#16213e',
  },
  typeBtnActive: { borderColor: '#e94560' },
  typeText: { color: '#888', fontSize: 12, fontWeight: '600' },
  typeTextActive: { color: '#e94560' },
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
  maxBtn: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1a1a2e',
  },
  maxBtnText: { color: '#4ecca3', fontSize: 12, fontWeight: '600' },
  saveBtn: {
    backgroundColor: '#4ecca3',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 30,
  },
  saveBtnText: { color: '#0f0f23', fontSize: 16, fontWeight: '700' },
});
