import streamDeck, { type Device } from "@elgato/streamdeck";
import { RunCommandAction } from "./actions/run-command";
import { createVSCodeClient } from "./vscode-client";
import { setSlotDataArray } from "./slot";
import { vscodeClient, setVSCodeClient } from "./vscode-client-global";
import { handleTaskComplete, setRefreshCallback } from "./status-handler";
import { renderAllButtons } from "./render";

type GlobalSettings = {
  port?: string;
}

const DEFAULT_PORT = 52375;

function getProfileNameForDevice(device: Device): string {
  switch (device.type) {
    case 1:
      return "VSCode-Runner-6";
    case 7:
    case 8:
      return "VSCode-Runner-8";
    case 2:
      return "VSCode-Runner-32";
    default:
      return "VSCode-Runner-15";
  }
}

let currentPort = DEFAULT_PORT;
let connecting = false;

streamDeck.logger.setLevel("debug");

streamDeck.actions.registerAction(new RunCommandAction());

streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((ev) => {
  const newPort = parseInt(ev.settings.port ?? "", 10) || DEFAULT_PORT;
  if (newPort !== currentPort) {
    streamDeck.logger.info(`Port changed: ${currentPort} -> ${newPort}`);
    currentPort = newPort;
    if (vscodeClient) {
      vscodeClient.disconnect();
    }
  }
});

async function initialize(): Promise<void> {
  const globalSettings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
  currentPort = parseInt(globalSettings.port ?? "", 10) || DEFAULT_PORT;
  streamDeck.logger.info(`Using port: ${currentPort}`);
  void connectToVSCode();
}

void initialize();

async function handleRefresh(): Promise<void> {
  if (!vscodeClient) return;

  try {
    const slotDataArray = await vscodeClient.fetchSlots();
    setSlotDataArray(slotDataArray);
    await renderAllButtons();
  } catch (e) {
    streamDeck.logger.error(`Failed to refresh buttons: ${e}`);
  }
}

setRefreshCallback(handleRefresh);

function switchToDefaultProfile(): void {
  for (const device of streamDeck.devices) {
    streamDeck.profiles.switchToProfile(device.id);
  }
}

function handleActivate(): void {
  streamDeck.logger.info("Activating VSCode profile");
  for (const device of streamDeck.devices) {
    const profileName = getProfileNameForDevice(device);
    streamDeck.logger.info(`Switching device ${device.id} (type=${device.type}) to ${profileName}`);
    streamDeck.profiles.switchToProfile(device.id, profileName);
  }
}

function handleDeactivate(): void {
  streamDeck.logger.info("Deactivating VSCode profile");
  switchToDefaultProfile();
}

function handleDisconnect(): void {
  streamDeck.logger.info("Disconnected from VSCode");
  setVSCodeClient(undefined);
  setSlotDataArray([]);
  switchToDefaultProfile();
  connecting = false;
  void connectToVSCode();
}

const RETRY_INTERVAL = 3000;

async function connectToVSCode(): Promise<void> {
  if (vscodeClient) return;
  if (connecting) return;
  connecting = true;

  const newClient = createVSCodeClient({
    port: currentPort,
    onRefresh: handleRefresh,
    onTaskComplete: handleTaskComplete,
    onActivate: handleActivate,
    onDeactivate: handleDeactivate,
    onDisconnect: handleDisconnect,
  });

  try {
    const slotDataArray = await newClient.connect();
    setVSCodeClient(newClient);
    connecting = false;
    setSlotDataArray(slotDataArray);
    streamDeck.logger.info(`Connected to VSCode, got ${slotDataArray.length} buttons`);
    await renderAllButtons();
  } catch (e) {
    streamDeck.logger.error(`Failed to connect to VSCode: ${e}`);
    connecting = false;
    setTimeout(() => connectToVSCode(), RETRY_INTERVAL);
  }
}

streamDeck.system.onApplicationDidLaunch((ev) => {
  streamDeck.logger.info(`Application launched: ${ev.application}`);
  connectToVSCode();
});


streamDeck.connect();
