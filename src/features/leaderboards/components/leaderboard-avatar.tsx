import { Image } from 'expo-image';
import { memo } from 'react';
import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { useAppTheme } from '@/theme';
export const LeaderboardAvatar = memo(function LeaderboardAvatar({ uri,name,userId,size = 48 }:{ uri:string|null; name:string; userId:string; size?:number }) {
  const theme = useAppTheme();
  return uri ? <Image source={{ uri }} enforceEarlyResizing recyclingKey={userId} cachePolicy="memory-disk" contentFit="cover" accessible={false} style={{ width:size,height:size,borderRadius:size/2 }} />
    : <View accessible={false} style={{ width:size,height:size,borderRadius:size/2,backgroundColor:theme.colors.surfaceMuted,alignItems:'center',justifyContent:'center' }}><Text style={[theme.typography.title,{ color:theme.colors.text }]}>{name.slice(0,1).toUpperCase() || '?'}</Text></View>;
});
