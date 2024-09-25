import { api, getConnection, getTrashCollection } from '@rocket.chat/core-services';
import { broker } from '@rocket.chat/network-broker';

import { registerServiceModels } from '../../../../apps/meteor/ee/server/lib/registerServiceModels';

(async () => {
	const db = await getConnection();

	registerServiceModels(db, await getTrashCollection());

	api.setBroker(broker);

	// need to import service after models are registered
	const { NotificationsModule } = await import('../../../../apps/meteor/server/modules/notifications/notifications.module');
	const { DDPStreamer } = await import('./DDPStreamer');
	const { Stream } = await import('./Streamer');

	const notifications = new NotificationsModule(Stream);

	notifications.configure();

	api.registerService(new DDPStreamer(notifications));

	await api.start();
})();
