import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { DebtDetailScreen } from '../../../src/features/debts/DebtDetailScreen';

export default function DebtDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DebtDetailScreen debtId={id || 'default'} />;
}
