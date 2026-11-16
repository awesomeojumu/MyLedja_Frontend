import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CategoryDetailScreen } from '../../../../src/features/budget/CategoryDetailScreen';

export default function CategoryDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CategoryDetailScreen categoryId={id || 'default'} />;
}
