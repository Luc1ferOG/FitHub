import AsyncStorage from '@react-native-async-storage/async-storage';
import { waitFor } from '@testing-library/react-native';
import { ChallengePushService } from '../challenge-push';
import type { PushDeviceRepository } from '../push-device-repository';

jest.mock('expo-constants',() => ({ __esModule:true,default:{ easConfig:{ projectId:'test-project' } } }));
jest.mock('expo-notifications',() => ({ getPermissionsAsync:jest.fn(async() => ({ granted:true })),getExpoPushTokenAsync:jest.fn(async() => ({ data:'ExpoPushToken[test-token]' })),setNotificationChannelAsync:jest.fn(),AndroidImportance:{ DEFAULT:3 } }));
describe('challenge push device lifecycle',() => {
  beforeEach(async () => { await AsyncStorage.clear(); jest.clearAllMocks(); });
  it('serializes unregister after in-flight registration for safe logout',async () => {
    let complete:() => void = () => undefined;
    const registered = new Promise<void>((resolve) => { complete = resolve; });
    const repository:PushDeviceRepository = { register:jest.fn(() => registered),unregister:jest.fn(async() => undefined) };
    const service = new ChallengePushService(repository); const enabling = service.enable(); const disabling = service.disable();
    await waitFor(() => expect(repository.register).toHaveBeenCalled());
    expect(repository.unregister).not.toHaveBeenCalled();
    complete(); await enabling; await disabling; expect(repository.unregister).toHaveBeenCalledWith('ExpoPushToken[test-token]');
    expect(await AsyncStorage.getItem('fithub:challenge-push-token')).toBeNull();
  });
  it('retains the token if unregister fails so a reconnect can retry',async () => {
    const repository:PushDeviceRepository = { register:jest.fn(async() => undefined),unregister:jest.fn(async() => { throw new Error('Offline'); }) };
    const service = new ChallengePushService(repository); await service.enable(); await expect(service.disable()).rejects.toThrow('Offline');
    expect(await AsyncStorage.getItem('fithub:challenge-push-token')).toBe('ExpoPushToken[test-token]');
  });
});
