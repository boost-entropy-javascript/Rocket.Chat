import { ServiceClassInternal } from '@rocket.chat/core-services';
import type { IAppsEngineService } from '@rocket.chat/core-services';
import type { AppStatus } from '@rocket.chat/apps-engine/definition/AppStatus';
import { AppStatusUtils } from '@rocket.chat/apps-engine/definition/AppStatus';
import type { ISetting } from '@rocket.chat/core-typings';

import { Apps, AppEvents } from '../../../ee/server/apps/orchestrator';
import { AppEvents as AppLifeCycleEvents } from '../../../ee/server/apps/communication/websockets';
import notifications from '../../../app/notifications/server/lib/Notifications';
import { SystemLogger } from '../../lib/logger/system';

export class AppsEngineService extends ServiceClassInternal implements IAppsEngineService {
	protected name = 'apps-engine';

	constructor() {
		super();

		this.onEvent('presence.status', async ({ user, previousStatus }): Promise<void> => {
			Apps.triggerEvent(AppEvents.IPostUserStatusChanged, {
				user,
				currentStatus: user.status,
				previousStatus,
			});
		});

		this.onEvent('apps.added', async (appId: string): Promise<void> => {
			await (Apps.getManager() as any)?.loadOne(appId);
			notifications.streamApps.emitWithoutBroadcast(AppLifeCycleEvents.APP_ADDED, appId);
		});

		this.onEvent('apps.removed', async (appId: string): Promise<void> => {
			const app = Apps.getManager()?.getOneById(appId);

			if (!app) {
				return;
			}

			await Apps.getManager()?.removeLocal(appId);
			notifications.streamApps.emitWithoutBroadcast(AppLifeCycleEvents.APP_REMOVED, appId);
		});

		this.onEvent('apps.updated', async (appId: string): Promise<void> => {
			const storageItem = await Apps.getStorage()?.retrieveOne(appId);

			if (!storageItem) {
				return;
			}

			const appPackage = await Apps.getAppSourceStorage()?.fetch(storageItem);

			if (!appPackage) {
				return;
			}

			await Apps.getManager()?.updateLocal(storageItem, appPackage);

			notifications.streamApps.emitWithoutBroadcast(AppLifeCycleEvents.APP_UPDATED, appId);
		});

		this.onEvent('apps.statusUpdate', async (appId: string, status: AppStatus): Promise<void> => {
			const app = Apps.getManager()?.getOneById(appId);

			if (!app || app.getStatus() === status) {
				return;
			}

			if (AppStatusUtils.isEnabled(status)) {
				await Apps.getManager()?.enable(appId).catch(SystemLogger.error);
				notifications.streamApps.emitWithoutBroadcast(AppLifeCycleEvents.APP_STATUS_CHANGE, { appId, status });
			} else if (AppStatusUtils.isDisabled(status)) {
				await Apps.getManager()?.disable(appId, status, true).catch(SystemLogger.error);
				notifications.streamApps.emitWithoutBroadcast(AppLifeCycleEvents.APP_STATUS_CHANGE, { appId, status });
			}
		});

		this.onEvent('apps.settingUpdated', async (appId: string, setting: ISetting): Promise<void> => {
			const appManager = Apps.getManager();

			if (!appManager) {
				return;
			}

			await appManager.getSettingsManager().updateAppSetting(appId, setting as any);
			notifications.streamApps.emitWithoutBroadcast(AppLifeCycleEvents.APP_SETTING_UPDATED, { appId });
		});

		this.onEvent('command.added', (command: string) => {
			notifications.streamApps.emitWithoutBroadcast(AppLifeCycleEvents.COMMAND_ADDED, command);
		});

		this.onEvent('command.disabled', (command: string) => {
			notifications.streamApps.emitWithoutBroadcast(AppLifeCycleEvents.COMMAND_DISABLED, command);
		});

		this.onEvent('command.updated', (command: string) => {
			notifications.streamApps.emitWithoutBroadcast(AppLifeCycleEvents.COMMAND_UPDATED, command);
		});

		this.onEvent('command.removed', (command: string) => {
			notifications.streamApps.emitWithoutBroadcast(AppLifeCycleEvents.COMMAND_REMOVED, command);
		});

		this.onEvent('actions.changed', () => {
			notifications.streamApps.emitWithoutBroadcast(AppLifeCycleEvents.ACTIONS_CHANGED);
		});
	}
}
