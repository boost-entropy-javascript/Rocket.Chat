import type { App, AppPermission } from '@rocket.chat/core-typings';

import { Apps } from '../../../../ee/client/apps/orchestrator';
import { handleAPIError } from './handleAPIError';
import { warnStatusChange } from './warnStatusChange';

type updateAppProps = App & {
	permissionsGranted?: AppPermission[];
};

export const updateApp = async ({ id, name, marketplaceVersion, permissionsGranted }: updateAppProps): Promise<void> => {
	try {
		const { status } = await Apps.updateApp(id, marketplaceVersion, permissionsGranted);
		if (status) {
			warnStatusChange(name, status);
		}
	} catch (error) {
		handleAPIError(error);
	}
};
