import type { IRole, AtLeast } from '@rocket.chat/core-typings';
import { Roles } from '@rocket.chat/models';

import { notifyListenerOnRoleChanges } from '../../../app/lib/server/lib/notifyListenerOnRoleChanges';

export const createOrUpdateProtectedRoleAsync = async (
	roleId: string,
	roleData: AtLeast<Omit<IRole, '_id' | 'protected'>, 'name'>,
): Promise<void> => {
	const role = await Roles.findOneById<Pick<IRole, '_id' | 'name' | 'scope' | 'description' | 'mandatory2fa'>>(roleId, {
		projection: { name: 1, scope: 1, description: 1, mandatory2fa: 1 },
	});

	if (role) {
		const updatedRole = await Roles.updateById(
			roleId,
			roleData.name || role.name,
			roleData.scope || role.scope,
			roleData.description || role.description,
			roleData.mandatory2fa || role.mandatory2fa,
		);

		void notifyListenerOnRoleChanges(roleId, 'updated', updatedRole);

		return;
	}

	const insertedRole = await Roles.insertOne({
		_id: roleId,
		scope: 'Users',
		description: '',
		mandatory2fa: false,
		...roleData,
		protected: true,
	});

	void notifyListenerOnRoleChanges(insertedRole.insertedId, 'inserted');
};
