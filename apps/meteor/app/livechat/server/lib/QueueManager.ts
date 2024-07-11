import { Apps, AppEvents } from '@rocket.chat/apps';
import { Omnichannel } from '@rocket.chat/core-services';
import {
	LivechatInquiryStatus,
	type ILivechatInquiryRecord,
	type ILivechatVisitor,
	type IOmnichannelRoom,
	type SelectedAgent,
	type OmnichannelSourceType,
} from '@rocket.chat/core-typings';
import { Logger } from '@rocket.chat/logger';
import { LivechatInquiry, LivechatRooms, Users } from '@rocket.chat/models';
import { Random } from '@rocket.chat/random';
import { Match, check } from 'meteor/check';
import { Meteor } from 'meteor/meteor';

import { callbacks } from '../../../../lib/callbacks';
import {
	notifyOnLivechatInquiryChangedById,
	notifyOnLivechatInquiryChanged,
	notifyOnSettingChanged,
} from '../../../lib/server/lib/notifyListener';
import { createLivechatRoom, createLivechatInquiry } from './Helper';
import { Livechat as LivechatTyped } from './LivechatTyped';
import { RoutingManager } from './RoutingManager';

const logger = new Logger('QueueManager');

export const saveQueueInquiry = async (inquiry: ILivechatInquiryRecord) => {
	const queuedInquiry = await LivechatInquiry.queueInquiry(inquiry._id);
	if (!queuedInquiry) {
		return;
	}

	await callbacks.run('livechat.afterInquiryQueued', queuedInquiry);

	void notifyOnLivechatInquiryChanged(queuedInquiry, 'updated', {
		status: LivechatInquiryStatus.QUEUED,
		queuedAt: new Date(),
		takenAt: undefined,
	});
};

export const queueInquiry = async (inquiry: ILivechatInquiryRecord, defaultAgent?: SelectedAgent) => {
	const inquiryAgent = await RoutingManager.delegateAgent(defaultAgent, inquiry);
	logger.debug(`Delegating inquiry with id ${inquiry._id} to agent ${defaultAgent?.username}`);

	await callbacks.run('livechat.beforeRouteChat', inquiry, inquiryAgent);
	const room = await LivechatRooms.findOneById(inquiry.rid);
	if (!room || !(await Omnichannel.isWithinMACLimit(room))) {
		logger.error({ msg: 'MAC limit reached, not routing inquiry', inquiry });
		// We'll queue these inquiries so when new license is applied, they just start rolling again
		// Minimizing disruption
		await saveQueueInquiry(inquiry);
		return;
	}
	const dbInquiry = await LivechatInquiry.findOneById(inquiry._id);

	if (!dbInquiry) {
		throw new Error('inquiry-not-found');
	}

	if (dbInquiry.status === 'ready') {
		logger.debug(`Inquiry with id ${inquiry._id} is ready. Delegating to agent ${inquiryAgent?.username}`);
		return RoutingManager.delegateInquiry(dbInquiry, inquiryAgent, undefined, room);
	}
};

interface IQueueManager {
	requestRoom: <
		E extends Record<string, unknown> & {
			sla?: string;
			customFields?: Record<string, unknown>;
			source?: OmnichannelSourceType;
		},
	>(params: {
		guest: ILivechatVisitor;
		rid?: string;
		message?: string;
		roomInfo: {
			source?: IOmnichannelRoom['source'];
			[key: string]: unknown;
		};
		agent?: SelectedAgent;
		extraData?: E;
	}) => Promise<IOmnichannelRoom>;
	unarchiveRoom: (archivedRoom?: IOmnichannelRoom) => Promise<IOmnichannelRoom>;
}

export const QueueManager = new (class implements IQueueManager {
	private async checkServiceStatus({ guest, agent }: { guest: Pick<ILivechatVisitor, 'department'>; agent?: SelectedAgent }) {
		if (!agent) {
			return LivechatTyped.online(guest.department);
		}

		const { agentId } = agent;
		const users = await Users.countOnlineAgents(agentId);
		return users > 0;
	}

	async requestRoom<
		E extends Record<string, unknown> & {
			sla?: string;
			customFields?: Record<string, unknown>;
			source?: OmnichannelSourceType;
		},
	>({
		guest,
		rid = Random.id(),
		message,
		roomInfo,
		agent,
		extraData: { customFields, ...extraData } = {} as E,
	}: {
		guest: ILivechatVisitor;
		rid?: string;
		message?: string;
		roomInfo: {
			source?: IOmnichannelRoom['source'];
			[key: string]: unknown;
		};
		agent?: SelectedAgent;
		extraData?: E;
	}) {
		logger.debug(`Requesting a room for guest ${guest._id}`);
		check(
			guest,
			Match.ObjectIncluding({
				_id: String,
				username: String,
				status: Match.Maybe(String),
				department: Match.Maybe(String),
				name: Match.Maybe(String),
				activity: Match.Maybe([String]),
			}),
		);

		if (!(await this.checkServiceStatus({ guest, agent }))) {
			throw new Meteor.Error('no-agent-online', 'Sorry, no online agents');
		}

		const name = (roomInfo?.fname as string) || guest.name || guest.username;

		const room = await LivechatRooms.findOneById(
			await createLivechatRoom(rid, name, guest, roomInfo, {
				...(Boolean(customFields) && { customFields }),
				...extraData,
			}),
		);
		if (!room) {
			logger.error(`Room for visitor ${guest._id} not found`);
			throw new Error('room-not-found');
		}
		logger.debug(`Room for visitor ${guest._id} created with id ${room._id}`);

		const inquiry = await LivechatInquiry.findOneById(
			await createLivechatInquiry({
				rid,
				name,
				guest,
				message,
				extraData: { ...extraData, source: roomInfo.source },
			}),
		);
		if (!inquiry) {
			logger.error(`Inquiry for visitor ${guest._id} not found`);
			throw new Error('inquiry-not-found');
		}

		void Apps.self?.triggerEvent(AppEvents.IPostLivechatRoomStarted, room);

		const livechatSetting = await LivechatRooms.updateRoomCount();
		if (livechatSetting) {
			void notifyOnSettingChanged(livechatSetting);
		}

		await queueInquiry(inquiry, agent);
		logger.debug(`Inquiry ${inquiry._id} queued`);

		const newRoom = await LivechatRooms.findOneById(rid);
		if (!newRoom) {
			logger.error(`Room with id ${rid} not found`);
			throw new Error('room-not-found');
		}

		return newRoom;
	}

	async unarchiveRoom(archivedRoom?: IOmnichannelRoom) {
		if (!archivedRoom) {
			throw new Error('no-room-to-unarchive');
		}

		const { _id: rid, open, closedAt, fname: name, servedBy, v, departmentId: department, lastMessage: message, source } = archivedRoom;

		if (!rid || !closedAt || !!open) {
			return archivedRoom;
		}

		logger.debug(`Attempting to unarchive room with id ${rid}`);

		const oldInquiry = await LivechatInquiry.findOneByRoomId<Pick<ILivechatInquiryRecord, '_id'>>(rid, { projection: { _id: 1 } });
		if (oldInquiry) {
			logger.debug(`Removing old inquiry (${oldInquiry._id}) for room ${rid}`);
			await LivechatInquiry.removeByRoomId(rid);
			void notifyOnLivechatInquiryChangedById(oldInquiry._id, 'removed');
		}

		const guest = {
			...v,
			...(department && { department }),
		};

		let defaultAgent: SelectedAgent | undefined;
		if (servedBy?.username && (await Users.findOneOnlineAgentByUserList(servedBy.username))) {
			defaultAgent = { agentId: servedBy._id, username: servedBy.username };
		}

		await LivechatRooms.unarchiveOneById(rid);
		const room = await LivechatRooms.findOneById(rid);
		if (!room) {
			throw new Error('room-not-found');
		}
		const inquiry = await LivechatInquiry.findOneById(
			await createLivechatInquiry({
				rid,
				name,
				guest,
				message: message?.msg,
				extraData: { source },
			}),
		);
		if (!inquiry) {
			throw new Error('inquiry-not-found');
		}

		await queueInquiry(inquiry, defaultAgent);
		logger.debug(`Inquiry ${inquiry._id} queued`);

		return room;
	}
})();
