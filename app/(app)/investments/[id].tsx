import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { HoldingDetailScreen } from '../../../src/features/investments/HoldingDetailScreen';

export default function HoldingDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <HoldingDetailScreen holdingId={id || 'default'} />;
}
