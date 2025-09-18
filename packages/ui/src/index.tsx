import { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type BannerProps = PropsWithChildren<{
  tone?: 'info' | 'warning' | 'success';
}>;

const toneStyles: Record<Required<BannerProps>['tone'], { backgroundColor: string; borderColor: string }> = {
  info: { backgroundColor: '#0F172A', borderColor: '#38BDF8' },
  warning: { backgroundColor: '#422006', borderColor: '#FACC15' },
  success: { backgroundColor: '#052E16', borderColor: '#4ADE80' }
};

export function Banner({ tone = 'info', children }: BannerProps) {
  const palette = toneStyles[tone];
  return (
    <View style={[styles.banner, { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor }]}>
      <Text style={styles.bannerText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1
  },
  bannerText: {
    color: '#F8FAFC',
    fontWeight: '600',
    fontSize: 16
  }
});
