import AsyncStorage from '@react-native-async-storage/async-storage';
import { Finance } from './types';

const STORAGE_KEY = 'finance_records';

export async function loadFinances(): Promise<Finance[]> {
  const json = await AsyncStorage.getItem(STORAGE_KEY);
  if (!json) return [];
  return JSON.parse(json);
}

export async function saveFinances(records: Finance[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export async function addFinance(record: Finance): Promise<void> {
  const records = await loadFinances();
  records.push(record);
  await saveFinances(records);
}

export async function updateFinance(updated: Finance): Promise<void> {
  const records = await loadFinances();
  const idx = records.findIndex((r) => r.id === updated.id);
  if (idx !== -1) {
    records[idx] = updated;
    await saveFinances(records);
  }
}

export async function deleteFinance(id: string): Promise<void> {
  const records = await loadFinances();
  await saveFinances(records.filter((r) => r.id !== id));
}
