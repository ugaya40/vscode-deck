import type { Disposable, Event } from "vscode";
import { EventEmitter } from "vscode";
import type { SlotData, SlotProvider, SlotProviderFactory, SlotProviderFactoryResult, RunResult, CancelResult, TaskCompleteEvent, ProviderNotifiers } from "./provider-types";
import type { ConfigManager } from "./config";

export interface ProviderRegistry {
  register(factory: SlotProviderFactory): Promise<Disposable>;
  providers: readonly SlotProvider[];
  onDidChange: Event<void>;
  onTaskComplete: Event<TaskCompleteEvent>;
  getAggregatedSlots(windowId: string): SlotData[];
  runCommand(slotDataId: string): Promise<RunResult>;
  cancelCommand(slotDataId: string): Promise<CancelResult>;
}

export function createProviderRegistry(configManager: ConfigManager): ProviderRegistry {
  const providerList: SlotProvider[] = [];
  const changeEmitter = new EventEmitter<void>();
  const taskCompleteEmitter = new EventEmitter<TaskCompleteEvent>();
  const providerDisposables = new Map<SlotProvider, Disposable[]>();

  configManager.onDidChange(() => {
    changeEmitter.fire();
  });

  async function register(factory: SlotProviderFactory): Promise<Disposable> {
    let currentProvider: SlotProvider;

    const notifiers: ProviderNotifiers = {
      notifyChange: () => changeEmitter.fire(),
      notifyTaskComplete: (event) => {
        taskCompleteEmitter.fire({
          scriptId: `${currentProvider.id}:${event.scriptId}`,
          result: event.result,
        });
      },
    };

    const { provider, disposables } = await factory(notifiers);
    currentProvider = provider;

    const existingIndex = providerList.findIndex((p) => p.id === provider.id);
    if (existingIndex >= 0) {
      const existingProvider = providerList[existingIndex];
      const existingDisposables = providerDisposables.get(existingProvider);
      if (existingDisposables) {
        existingDisposables.forEach((d) => d.dispose());
        providerDisposables.delete(existingProvider);
      }
      providerList.splice(existingIndex, 1);
    }

    providerList.push(provider);
    providerDisposables.set(provider, disposables);

    changeEmitter.fire();

    return {
      dispose: () => {
        const index = providerList.indexOf(provider);
        if (index >= 0) {
          providerList.splice(index, 1);
        }
        const disposableList = providerDisposables.get(provider);
        if (disposableList) {
          disposableList.forEach((d) => d.dispose());
          providerDisposables.delete(provider);
        }
        changeEmitter.fire();
      },
    };
  }

  function getAggregatedSlots(windowId: string): SlotData[] {
    const providersConfig = configManager.providersConfig();

    const sortedProviders = [...providerList].sort((a, b) => {
      const orderA = providersConfig[a.id]?.order ?? Number.MAX_SAFE_INTEGER;
      const orderB = providersConfig[b.id]?.order ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });

    const aggregatedSlots: SlotData[] = [];

    for (const provider of sortedProviders) {
      const providerConfig = providersConfig[provider.id];

      if (providerConfig?.enabled === false) {
        continue;
      }

      if (!provider.isActive()) {
        continue;
      }

      const slots = provider.getSlots();
      const maxSlots = providerConfig?.maxSlots;
      const limitedSlots = maxSlots !== undefined ? slots.slice(0, maxSlots) : slots;

      for (const slot of limitedSlots) {
        aggregatedSlots.push({
          ...slot,
          scriptId: `${windowId}:${provider.id}:${slot.scriptId}`,
        });
      }
    }

    return aggregatedSlots;
  }

  interface ParsedSlotDataId {
    providerId: string;
    scriptId: string;
  }

  function parseSlotDataId(slotDataId: string): ParsedSlotDataId | undefined {
    const firstColonIndex = slotDataId.indexOf(":");
    if (firstColonIndex === -1) return undefined;

    const afterWindowId = slotDataId.slice(firstColonIndex + 1);
    const secondColonIndex = afterWindowId.indexOf(":");
    if (secondColonIndex === -1) return undefined;

    return {
      providerId: afterWindowId.slice(0, secondColonIndex),
      scriptId: afterWindowId.slice(secondColonIndex + 1),
    };
  }

  async function runCommand(slotDataId: string): Promise<RunResult> {
    const parsed = parseSlotDataId(slotDataId);
    if (!parsed) {
      return { success: false, message: "Invalid slotDataId format" };
    }

    const provider = providerList.find((p) => p.id === parsed.providerId);
    if (!provider) {
      return { success: false, message: `Provider not found: ${parsed.providerId}` };
    }

    return provider.run(parsed.scriptId);
  }

  async function cancelCommand(slotDataId: string): Promise<CancelResult> {
    const parsed = parseSlotDataId(slotDataId);
    if (!parsed) {
      return { success: false, message: "Invalid slotDataId format" };
    }

    const provider = providerList.find((p) => p.id === parsed.providerId);
    if (!provider) {
      return { success: false, message: `Provider not found: ${parsed.providerId}` };
    }

    if (!provider.cancel) {
      return { success: false, message: "Cancel not supported by this provider" };
    }

    return provider.cancel(parsed.scriptId);
  }

  return {
    register,
    get providers() {
      return providerList as readonly SlotProvider[];
    },
    onDidChange: changeEmitter.event,
    onTaskComplete: taskCompleteEmitter.event,
    getAggregatedSlots,
    runCommand,
    cancelCommand,
  };
}
