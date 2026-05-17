import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { Finance } from '../types';
import { loadFinances } from '../storage';
import { calculateCurrentInterest, formatCurrency } from '../utils/interest';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const [records, setRecords] = useState<Finance[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'active' | 'closed' | 'all'>('active');

  const loadData = useCallback(async () => {
    const data = await loadFinances();
    setRecords(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const filtered = records.filter((r) => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  const totalOutstanding = filtered.reduce((sum, r) => {
    if (r.status === 'active') {
      return sum + r.remainingPrincipal + calculateCurrentInterest(r);
    }
    return sum;
  }, 0);

  const renderItem = ({ item }: { item: Finance }) => {
    const currentInterest = calculateCurrentInterest(item);
    const isClosed = item.status === 'closed';

    return (
      <TouchableOpacity
        style={[styles.card, isClosed && styles.cardClosed]}
        onPress={() => navigation.navigate('Detail', { id: item.id })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.name}>{item.name}</Text>
          <View style={[styles.badge, isClosed ? styles.badgeClosed : styles.badgeActive]}>
            <Text style={styles.badgeText}>
              {isClosed ? 'CLOSED' : 'ACTIVE'}
            </Text>
          </View>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.label}>Principal</Text>
          <Text style={styles.value}>{formatCurrency(item.remainingPrincipal)}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.label}>Accrued Interest</Text>
          <Text style={[styles.value, styles.interestText]}>
            {formatCurrency(currentInterest)}
          </Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.label}>Rate</Text>
          <Text style={styles.value}>
            {item.interestRate}% / {item.period === 'weekly' ? 'week' : 'month'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.summaryBar}>
        <Text style={styles.summaryLabel}>Total Outstanding</Text>
        <Text style={styles.summaryValue}>{formatCurrency(totalOutstanding)}</Text>
      </View>

      <View style={styles.filterRow}>
        {(['active', 'closed', 'all'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No records yet</Text>
            <Text style={styles.emptySubtext}>Tap + to add a finance entry</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddFinance')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  summaryBar: {
    backgroundColor: '#1a1a2e',
    padding: 20,
    alignItems: 'center',
  },
  summaryLabel: { color: '#888', fontSize: 13, marginBottom: 4 },
  summaryValue: { color: '#fff', fontSize: 28, fontWeight: '700' },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
  },
  filterBtnActive: { backgroundColor: '#e94560' },
  filterText: { color: '#888', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#e94560',
  },
  cardClosed: { borderLeftColor: '#4ecca3', opacity: 0.7 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  name: { color: '#fff', fontSize: 18, fontWeight: '700', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeActive: { backgroundColor: '#e94560' },
  badgeClosed: { backgroundColor: '#4ecca3' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: { color: '#888', fontSize: 13 },
  value: { color: '#fff', fontSize: 14, fontWeight: '600' },
  interestText: { color: '#e94560' },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: '#888', fontSize: 18 },
  emptySubtext: { color: '#555', fontSize: 14, marginTop: 8 },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e94560',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#e94560',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  fabText: { color: '#fff', fontSize: 30, lineHeight: 32 },
});
