import type { IExportOperation, RocketChatRecordDeleted } from '@rocket.chat/core-typings';
import type { IExportOperationsModel } from '@rocket.chat/model-typings';
import type { Collection, Cursor, Db, IndexSpecification, UpdateWriteOpResult } from 'mongodb';
import { getCollectionName } from '@rocket.chat/models';

import { BaseRaw } from './BaseRaw';

export class ExportOperationsRaw extends BaseRaw<IExportOperation> implements IExportOperationsModel {
	constructor(db: Db, trash?: Collection<RocketChatRecordDeleted<IExportOperation>>) {
		super(db, getCollectionName('export_operations'), trash);
	}

	protected modelIndexes(): IndexSpecification[] {
		return [{ key: { userId: 1 } }, { key: { status: 1 } }];
	}

	findOnePending(): Promise<IExportOperation | null> {
		const query = {
			status: { $nin: ['completed', 'skipped'] },
		};

		return this.findOne(query);
	}

	async create(data: IExportOperation): Promise<string> {
		const result = await this.insertOne({
			...data,
			createdAt: new Date(),
		});

		return result.insertedId;
	}

	findLastOperationByUser(userId: string, fullExport = false): Promise<IExportOperation | null> {
		const query = {
			userId,
			fullExport,
		};

		return this.findOne(query, { sort: { createdAt: -1 } });
	}

	findAllPendingBeforeMyRequest(requestDay: Date): Cursor<IExportOperation> {
		const query = {
			status: { $nin: ['completed', 'skipped'] },
			createdAt: { $lt: requestDay },
		};

		return this.find(query);
	}

	updateOperation(data: IExportOperation): Promise<UpdateWriteOpResult> {
		const update = {
			$set: {
				roomList: data.roomList,
				status: data.status,
				fileList: data.fileList,
				generatedFile: data.generatedFile,
				fileId: data.fileId,
				userNameTable: data.userNameTable,
				userData: data.userData,
				generatedUserFile: data.generatedUserFile,
				generatedAvatar: data.generatedAvatar,
				exportPath: data.exportPath,
				assetsPath: data.assetsPath,
			},
		};

		return this.updateOne({ _id: data._id }, update);
	}
}
