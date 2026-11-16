import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ReconcileScreen } from '../../../../src/features/accounts/ReconcileScreen';

export default function ReconcileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReconcileScreen accountId={id || 'default'} />;
}
