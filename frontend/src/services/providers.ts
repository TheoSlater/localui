import * as Bindings from '../../bindings/changeme/internal/providers/service';
import type { Provider } from '../../bindings/changeme/internal/database/models';

export type { Provider } from '../../bindings/changeme/internal/database/models';
export type ProviderWithKey = Provider & { hasApiKey: boolean };

export function listProviders(): Promise<Provider[]> {
  return Bindings.ListProviders().then((items) => (items ?? []) as Provider[]);
}

export function saveProvider(provider: Provider): Promise<void> {
  return Bindings.SaveProvider(provider as Provider);
}

export function deleteProvider(id: string): Promise<void> {
  return Bindings.DeleteProvider(id);
}

export function hasProviderApiKey(id: string): Promise<boolean> {
  return Bindings.HasProviderAPIKey(id);
}

export function getProviderApiKey(id: string): Promise<string> {
  return Bindings.APIKey(id);
}

export function setProviderApiKey(id: string, key: string): Promise<void> {
  return Bindings.SetProviderAPIKey(id, key);
}

export function deleteProviderApiKey(id: string): Promise<void> {
  return Bindings.DeleteProviderAPIKey(id);
}
