import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { AccountDetailScreen } from '../../../../src/features/accounts/AccountDetailScreen';

export default function AccountDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AccountDetailScreen accountId={id || 'default'} />;
}
