import type { EventSignatures } from '@rocket.chat/core-services';
import { dbWatchersDisabled } from '@rocket.chat/core-services';
import type {
	ISubscription,
	IUser,
	ILoginServiceConfiguration,
	IIntegrationHistory,
	ILivechatDepartmentAgents,
	IMessage,
	IPermission,
	ISetting,
	IRoom,
	IInstanceStatus,
	IIntegration,
	IEmailInbox,
	IPbxEvent,
	SettingValue,
	ILivechatInquiryRecord,
	IRole,
	ILivechatPriority,
} from '@rocket.chat/core-typings';
import {
	Subscriptions,
	Messages,
	Users,
	Settings,
	Roles,
	LivechatInquiry,
	LivechatDepartmentAgents,
	Rooms,
	LoginServiceConfiguration,
	InstanceStatus,
	IntegrationHistory,
	Integrations,
	EmailInbox,
	PbxEvents,
	Permissions,
	LivechatPriority,
} from '@rocket.chat/models';
import mem from 'mem';

import { subscriptionFields, roomFields } from '../../../lib/publishFields';
import type { DatabaseWatcher } from '../../database/DatabaseWatcher';

type BroadcastCallback = <T extends keyof EventSignatures>(event: T, ...args: Parameters<EventSignatures[T]>) => Promise<void>;

const hasKeys =
	(requiredKeys: string[]): ((data?: Record<string, any>) => boolean) =>
	(data?: Record<string, any>): boolean => {
		if (!data) {
			return false;
		}

		return Object.keys(data)
			.filter((key) => key !== '_id')
			.map((key) => key.split('.')[0])
			.some((key) => requiredKeys.includes(key));
	};

const hasRoomFields = hasKeys(Object.keys(roomFields));
const hasSubscriptionFields = hasKeys(Object.keys(subscriptionFields));

let watcherStarted = false;
export function isWatcherRunning(): boolean {
	return watcherStarted;
}

const getSettingCached = mem(async (setting: string): Promise<SettingValue> => Settings.getValueById(setting), { maxAge: 10000 });

const getUserNameCached = mem(
	async (userId: string): Promise<string | undefined> => {
		const user = await Users.findOne<Pick<IUser, 'name'>>(userId, { projection: { name: 1 } });
		return user?.name;
	},
	{ maxAge: 10000 },
);

const messageWatcher = (watcher: DatabaseWatcher, broadcast: BroadcastCallback): void => {
	watcher.on<IMessage>(Messages.getCollectionName(), async ({ clientAction, id, data }) => {
		switch (clientAction) {
			case 'inserted':
			case 'updated':
				const message = data ?? (await Messages.findOneById(id));
				if (!message) {
					return;
				}

				if (message._hidden !== true && message.imported == null) {
					const UseRealName = (await getSettingCached('UI_Use_Real_Name')) === true;

					if (UseRealName) {
						if (message.u?._id) {
							const name = await getUserNameCached(message.u._id);
							if (name) {
								message.u.name = name;
							}
						}

						if (message.mentions?.length) {
							for await (const mention of message.mentions) {
								const name = await getUserNameCached(mention._id);
								if (name) {
									mention.name = name;
								}
							}
						}
					}

					void broadcast('watch.messages', { clientAction, message });
				}
				break;
		}
	});
};

export function initWatchers(watcher: DatabaseWatcher, broadcast: BroadcastCallback): void {
	const dbWatchersEnabled = !dbWatchersDisabled;
	if (dbWatchersEnabled) {
		messageWatcher(watcher, broadcast);
	}

	watcher.on<ISubscription>(Subscriptions.getCollectionName(), async ({ clientAction, id, data, diff }) => {
		switch (clientAction) {
			case 'inserted':
			case 'updated': {
				if (!hasSubscriptionFields(data || diff)) {
					return;
				}

				// Override data cuz we do not publish all fields
				const subscription =
					data ||
					(await Subscriptions.findOneById<
						Pick<
							ISubscription,
							| 't'
							| 'ts'
							| 'ls'
							| 'lr'
							| 'name'
							| 'fname'
							| 'rid'
							| 'code'
							| 'f'
							| 'u'
							| 'open'
							| 'alert'
							| 'roles'
							| 'unread'
							| 'prid'
							| 'userMentions'
							| 'groupMentions'
							| 'archived'
							| 'audioNotificationValue'
							| 'desktopNotifications'
							| 'mobilePushNotifications'
							| 'emailNotifications'
							| 'desktopPrefOrigin'
							| 'mobilePrefOrigin'
							| 'emailPrefOrigin'
							| 'unreadAlert'
							| '_updatedAt'
							| 'blocked'
							| 'blocker'
							| 'autoTranslate'
							| 'autoTranslateLanguage'
							| 'disableNotifications'
							| 'hideUnreadStatus'
							| 'hideMentionStatus'
							| 'muteGroupMentions'
							| 'ignored'
							| 'E2EKey'
							| 'E2ESuggestedKey'
							| 'tunread'
							| 'tunreadGroup'
							| 'tunreadUser'

							// Omnichannel fields
							| 'department'
							| 'v'
							| 'onHold'
						>
					>(id, {
						projection: subscriptionFields,
					}));

				if (!subscription) {
					return;
				}
				void broadcast('watch.subscriptions', { clientAction, subscription });
				break;
			}

			case 'removed': {
				const trash = (await Subscriptions.trashFindOneById(id, {
					projection: { u: 1, rid: 1 },
				})) as Pick<ISubscription, 'u' | 'rid' | '_id'> | undefined;
				const subscription = trash || { _id: id };
				void broadcast('watch.subscriptions', { clientAction, subscription });
				break;
			}
		}
	});

	watcher.on<IRole>(Roles.getCollectionName(), async ({ clientAction, id, data, diff }) => {
		if (diff && Object.keys(diff).length === 1 && diff._updatedAt) {
			// avoid useless changes
			return;
		}

		if (clientAction === 'removed') {
			void broadcast('watch.roles', {
				clientAction: 'removed',
				role: {
					_id: id,
					name: id,
				},
			});
			return;
		}

		const role = data || (await Roles.findOneById(id));

		if (!role) {
			return;
		}

		void broadcast('watch.roles', {
			clientAction: 'changed',
			role,
		});
	});

	watcher.on<ILivechatInquiryRecord>(LivechatInquiry.getCollectionName(), async ({ clientAction, id, data, diff }) => {
		switch (clientAction) {
			case 'inserted':
			case 'updated':
				data = data ?? (await LivechatInquiry.findOneById(id)) ?? undefined;
				break;

			case 'removed':
				data = (await LivechatInquiry.trashFindOneById(id)) ?? undefined;
				break;
		}

		if (!data) {
			return;
		}

		void broadcast('watch.inquiries', { clientAction, inquiry: data, diff });
	});

	watcher.on<ILivechatDepartmentAgents>(LivechatDepartmentAgents.getCollectionName(), async ({ clientAction, id, diff }) => {
		if (clientAction === 'removed') {
			const data = await LivechatDepartmentAgents.trashFindOneById<Pick<ILivechatDepartmentAgents, 'agentId' | 'departmentId'>>(id, {
				projection: { agentId: 1, departmentId: 1 },
			});
			if (!data) {
				return;
			}
			void broadcast('watch.livechatDepartmentAgents', { clientAction, id, data, diff });
			return;
		}

		const data = await LivechatDepartmentAgents.findOneById<Pick<ILivechatDepartmentAgents, 'agentId' | 'departmentId'>>(id, {
			projection: { agentId: 1, departmentId: 1 },
		});
		if (!data) {
			return;
		}
		void broadcast('watch.livechatDepartmentAgents', { clientAction, id, data, diff });
	});

	watcher.on<IPermission>(Permissions.getCollectionName(), async ({ clientAction, id, data: eventData, diff }) => {
		if (diff && Object.keys(diff).length === 1 && diff._updatedAt) {
			// avoid useless changes
			return;
		}
		let data;
		switch (clientAction) {
			case 'updated':
			case 'inserted':
				data = eventData ?? (await Permissions.findOneById(id));
				break;

			case 'removed':
				data = { _id: id, roles: [] };
				break;
		}

		if (!data) {
			return;
		}

		void broadcast('permission.changed', { clientAction, data });

		if (data.level === 'settings' && data.settingId) {
			// if the permission changes, the effect on the visible settings depends on the role affected.
			// The selected-settings-based consumers have to react accordingly and either add or remove the
			// setting from the user's collection
			const setting = await Settings.findOneNotHiddenById(data.settingId);
			if (!setting) {
				return;
			}
			void broadcast('watch.settings', { clientAction: 'updated', setting });
		}
	});

	watcher.on<ISetting>(Settings.getCollectionName(), async ({ clientAction, id, data, diff }) => {
		if (diff && Object.keys(diff).length === 1 && diff._updatedAt) {
			// avoid useless changes
			return;
		}

		let setting;
		switch (clientAction) {
			case 'updated':
			case 'inserted': {
				setting = data ?? (await Settings.findOneById(id));
				break;
			}

			case 'removed': {
				setting = data ?? (await Settings.trashFindOneById(id));
				break;
			}
		}

		if (!setting) {
			return;
		}

		void broadcast('watch.settings', { clientAction, setting });
	});

	watcher.on<IRoom>(Rooms.getCollectionName(), async ({ clientAction, id, data, diff }) => {
		if (clientAction === 'removed') {
			void broadcast('watch.rooms', { clientAction, room: { _id: id } });
			return;
		}

		if (!hasRoomFields(data || diff)) {
			return;
		}

		const room = data ?? (await Rooms.findOneById(id, { projection: roomFields }));
		if (!room) {
			return;
		}

		void broadcast('watch.rooms', { clientAction, room });
	});

	// TODO: Prevent flood from database on username change, what causes changes on all past messages from that user
	// and most of those messages are not loaded by the clients.
	watcher.on<IUser>(Users.getCollectionName(), ({ clientAction, id, data, diff, unset }) => {
		// LivechatCount is updated each time an agent is routed to a chat. This prop is not used on the UI so we don't need
		// to broadcast events originated by it when it's the only update on the user
		if (diff && Object.keys(diff).length === 1 && 'livechatCount' in diff) {
			return;
		}

		if (clientAction === 'removed') {
			void broadcast('watch.users', { clientAction, id });
			return;
		}
		if (clientAction === 'inserted') {
			void broadcast('watch.users', { clientAction, id, data: data! });
			return;
		}

		void broadcast('watch.users', { clientAction, diff: diff!, unset: unset!, id });
	});

	watcher.on<ILoginServiceConfiguration>(LoginServiceConfiguration.getCollectionName(), async ({ clientAction, id }) => {
		const data = await LoginServiceConfiguration.findOne<Omit<ILoginServiceConfiguration, 'secret'>>(id, { projection: { secret: 0 } });
		if (!data) {
			return;
		}

		void broadcast('watch.loginServiceConfiguration', { clientAction, data, id });
	});

	watcher.on<IInstanceStatus>(InstanceStatus.getCollectionName(), ({ clientAction, id, data, diff }) => {
		if (clientAction === 'removed') {
			void broadcast('watch.instanceStatus', { clientAction, id, data: { _id: id } });
			return;
		}

		void broadcast('watch.instanceStatus', { clientAction, data, diff, id });
	});

	watcher.on<IIntegrationHistory>(IntegrationHistory.getCollectionName(), async ({ clientAction, id, data, diff }) => {
		switch (clientAction) {
			case 'updated': {
				const history = await IntegrationHistory.findOneById<Pick<IIntegrationHistory, 'integration'>>(id, {
					projection: { 'integration._id': 1 },
				});
				if (!history?.integration) {
					return;
				}
				void broadcast('watch.integrationHistory', { clientAction, data: history, diff, id });
				break;
			}
			case 'inserted': {
				if (!data) {
					return;
				}
				void broadcast('watch.integrationHistory', { clientAction, data, diff, id });
				break;
			}
		}
	});

	watcher.on<IIntegration>(Integrations.getCollectionName(), async ({ clientAction, id, data: eventData }) => {
		if (clientAction === 'removed') {
			void broadcast('watch.integrations', { clientAction, id, data: { _id: id } });
			return;
		}

		const data = eventData ?? (await Integrations.findOneById(id));
		if (!data) {
			return;
		}

		void broadcast('watch.integrations', { clientAction, data, id });
	});

	watcher.on<IEmailInbox>(EmailInbox.getCollectionName(), async ({ clientAction, id, data: eventData }) => {
		if (clientAction === 'removed') {
			void broadcast('watch.emailInbox', { clientAction, id, data: { _id: id } });
			return;
		}

		const data = eventData ?? (await EmailInbox.findOneById(id));
		if (!data) {
			return;
		}

		void broadcast('watch.emailInbox', { clientAction, data, id });
	});

	watcher.on<IPbxEvent>(PbxEvents.getCollectionName(), async ({ clientAction, id, data: eventData }) => {
		// For now, we just care about insertions here
		if (clientAction === 'inserted') {
			const data = eventData ?? (await PbxEvents.findOneById(id));
			if (!data || !['ContactStatus', 'Hangup'].includes(data.event)) {
				// For now, we'll only care about agent connect/disconnect events
				// Other events are not handled by watchers but by service
				return;
			}

			void broadcast('watch.pbxevents', { clientAction, data, id });
		}
	});

	watcher.on<ILivechatPriority>(LivechatPriority.getCollectionName(), async ({ clientAction, id, data: eventData, diff }) => {
		if (clientAction !== 'updated' || !diff || !('name' in diff)) {
			// For now, we don't support this actions from happening
			return;
		}

		const data = eventData ?? (await LivechatPriority.findOne({ _id: id }));
		if (!data) {
			return;
		}

		// This solves the problem of broadcasting, since now, watcher is the one in charge of doing it.
		// What i don't like is the idea of giving more responsibilities to watcher, even when this works
		void broadcast('watch.priorities', { clientAction, data, id, diff });
	});

	watcherStarted = true;
}
